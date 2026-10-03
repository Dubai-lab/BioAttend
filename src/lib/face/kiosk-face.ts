import { supabase } from '@/lib/supabase'
import { checkLiveness, getHuman, type LivenessRejection } from '@/lib/face/engine'
import { faceService } from '@/lib/face/service'
import type { FaceIdentifyResult, FaceVerifyResult } from '@/types/database'

export interface FaceVerifyByNumberResult {
  ok: boolean
  reason?: 'invalid_kiosk' | 'not_verified' | 'no_face_enrolled'
  staff_id?: string
  staff_name?: string
  staff_no?: string
  similarity?: number
}

/**
 * Face matching from the kiosk.
 *
 * The kiosk never sees stored embeddings — `face_embeddings` is admin-only
 * under RLS and the kiosk holds only the anon key. It sends a freshly
 * computed descriptor to a SECURITY DEFINER function and receives a decision.
 * A compromised kiosk therefore leaks no biometric data.
 */

/** pgvector accepts a bracketed literal. */
function toVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

export interface FaceScanFailure {
  ok: false
  reason: LivenessRejection | 'timeout' | 'no_embedding'
}

export interface FaceScanSuccess {
  ok: true
  embedding: number[]
  real: number
}

/**
 * Watch the camera until a live face appears, then embed it.
 *
 * Three stages:
 *
 *   1. Liveness, in the browser. Cheap, runs on every frame, and rejects
 *      photographs before anything is sent anywhere.
 *   2. Quality, judged on what the recognition service measured. A face that
 *      is small, turned away or weakly detected gives an embedding that sits
 *      far from the enrolled ones, and matching it is how a genuine person ends
 *      up "not recognised". Such frames are retried, not sent for matching.
 *   3. Averaging. Two good frames are embedded and averaged. One frame carries
 *      its own blink, blur and lighting; the mean of two is steadier, which is
 *      what lets the same person score the same way twice.
 *
 * Several consecutive live frames are required before embedding. A single
 * frame can catch a photo mid-wave; consecutive frames cannot.
 */
export interface FaceScanProgress {
  /** Is a live face currently visible? */
  detected: boolean
  /** Guidance to display, e.g. "Move closer". */
  message: string
  /** Consecutive good frames so far, against requiredFrames. */
  streak: number
  required: number
}

/** Below these the embedding is unreliable; the frame is retried instead. */
const MIN_DETECTION_SCORE = 0.6
/** Face area as a share of the frame. ~0.03 is a face about 110px wide at 640px. */
const MIN_FACE_COVERAGE = 0.03
const MAX_YAW = 25
const MAX_PITCH = 25

/** Good frames averaged into one probe. */
const SAMPLES = 2

function averaged(embeddings: number[][]): number[] {
  const mean = embeddings[0].map((_, i) => embeddings.reduce((sum, e) => sum + e[i], 0))
  const norm = Math.hypot(...mean) || 1
  return mean.map((value) => value / norm)
}

export async function scanForFace(
  video: HTMLVideoElement,
  {
    timeoutMs = 8000,
    requiredFrames = 3,
    onProgress,
  }: {
    timeoutMs?: number
    requiredFrames?: number
    onProgress?: (progress: FaceScanProgress) => void
  } = {},
): Promise<FaceScanSuccess | FaceScanFailure> {
  const human = await getHuman()
  const deadline = Date.now() + timeoutMs

  let streak = 0
  let bestReal = 0
  let lastReason: LivenessRejection = 'no_face'
  // Remembered separately because streak resets on every rejection, which
  // would otherwise report a photo held up for eight seconds as a timeout.
  let spoofSeen = false
  const samples: number[][] = []

  const report = (detected: boolean, message: string) =>
    onProgress?.({ detected, message, streak, required: requiredFrames })

  while (Date.now() < deadline) {
    if (video.readyState >= 2) {
      const liveness = await checkLiveness(human, video)

      if (liveness.ok) {
        streak += 1
        bestReal = Math.max(bestReal, liveness.reading.real)
        report(true, 'Hold still')

        if (streak >= requiredFrames) {
          const embedded = await faceService.embedFrame(video)
          if (!embedded.ok) {
            // The recognition model disagreed with the liveness detector about
            // whether there is a usable face. Keep watching rather than fail.
            streak = 0
            lastReason = embedded.reason === 'multiple_faces' ? 'multiple_faces' : 'no_face'
            continue
          }

          const problem =
            embedded.coverage < MIN_FACE_COVERAGE
              ? 'Move closer'
              : Math.abs(embedded.yaw) > MAX_YAW || Math.abs(embedded.pitch) > MAX_PITCH
                ? 'Look straight at the camera'
                : embedded.score < MIN_DETECTION_SCORE
                  ? 'Face the light and hold still'
                  : null

          if (problem) {
            report(true, problem)
            continue
          }

          samples.push(embedded.embedding)
          if (samples.length >= SAMPLES) {
            return { ok: true, embedding: averaged(samples), real: bestReal }
          }
        }
      } else {
        // A spoof attempt must not be averaged away by a few good frames.
        streak = 0
        samples.length = 0
        lastReason = liveness.reason
        if (liveness.reason === 'spoof') spoofSeen = true
        report(false, guidance(liveness.reason))
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 120))
  }

  // One good frame is still better than nothing when time runs out.
  if (samples.length > 0) return { ok: true, embedding: averaged(samples), real: bestReal }
  return { ok: false, reason: spoofSeen ? 'spoof' : streak > 0 ? lastReason : 'timeout' }
}

/** 1:1 — confirm the person the fingerprint already identified. */
export async function verifyFace(
  kioskCode: string,
  kioskToken: string,
  staffId: string,
  embedding: number[],
): Promise<FaceVerifyResult> {
  const { data, error } = await supabase.rpc('verify_face', {
    p_kiosk_code: kioskCode,
    p_kiosk_token: kioskToken,
    p_staff_id: staffId,
    p_embedding: toVector(embedding),
  })

  if (error) throw new Error(error.message)
  return data as FaceVerifyResult
}

/**
 * Primary fallback: identify by face alone, no typing.
 *
 * The database refuses to answer when two people score close together,
 * returning 'ambiguous' rather than picking the higher number. The caller
 * then falls back to asking for a staff number. Fast when the system is
 * sure; careful when it is not.
 */
export async function identifyByFace(
  kioskCode: string,
  kioskToken: string,
  embedding: number[],
): Promise<FaceIdentifyResult> {
  const { data, error } = await supabase.rpc('identify_face', {
    p_kiosk_code: kioskCode,
    p_kiosk_token: kioskToken,
    p_embedding: toVector(embedding),
  })

  if (error) throw new Error(error.message)
  return data as FaceIdentifyResult
}

/**
 * Secondary fallback: the person states who they are, face confirms it.
 *
 * This replaced 1:N identification after testing produced a false accept — a
 * sibling matched an enrolled face at 0.69-0.80 against a 0.62 threshold. No
 * threshold separated them, because 1:N with few identities really asks "does
 * this resemble the enrolled face at all?" and most faces do.
 *
 * 1:1 asks a far easier question and does not degrade as the roster grows.
 */
export async function verifyFaceByStaffNumber(
  kioskCode: string,
  kioskToken: string,
  staffNumber: string,
  embedding: number[],
): Promise<FaceVerifyByNumberResult> {
  const { data, error } = await supabase.rpc('verify_face_by_staff_no', {
    p_kiosk_code: kioskCode,
    p_kiosk_token: kioskToken,
    p_staff_no: staffNumber,
    p_embedding: toVector(embedding),
  })

  if (error) throw new Error(error.message)
  return data as FaceVerifyByNumberResult
}

/** True when 1:N could not safely name anyone and we should ask instead. */
export function needsStaffNumber(result: FaceIdentifyResult): boolean {
  return !result.matched && result.reason !== 'invalid_kiosk'
}

/**
 * Short guidance for the kiosk display.
 *
 * Deliberately terser than the enrolment messages: this is read at two metres
 * by someone already standing at the sensor, not by an operator at a desk.
 */
function guidance(reason: LivenessRejection): string {
  switch (reason) {
    case 'no_face':
      return 'Look at the camera'
    case 'multiple_faces':
      return 'Only one person at a time'
    case 'low_confidence':
      return 'Move closer'
    case 'spoof':
      return 'A photo cannot be used'
  }
}

export function describeFaceFailure(result: FaceVerifyByNumberResult): string {
  switch (result.reason) {
    case 'no_face_enrolled':
      return 'No face is enrolled for that staff number — see your supervisor'
    case 'invalid_kiosk':
      return 'This station is not authorised'
    case 'not_verified':
    default:
      // Deliberately does not distinguish "wrong number" from "face did not
      // match" — that difference would let someone probe the roster.
      return 'Could not confirm your identity — try again or see your supervisor'
  }
}
