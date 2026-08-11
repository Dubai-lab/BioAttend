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
 * Two stages, deliberately separated:
 *
 *   1. Liveness, in the browser. Cheap, runs on every frame, and rejects
 *      photographs before anything is sent anywhere.
 *   2. Embedding, from the local InsightFace service. Called once, on the
 *      frame that passed — recognition is the expensive step and there is no
 *      reason to run it on frames that will be discarded.
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

  while (Date.now() < deadline) {
    if (video.readyState >= 2) {
      const liveness = await checkLiveness(human, video)

      if (liveness.ok) {
        streak += 1
        bestReal = Math.max(bestReal, liveness.reading.real)

        onProgress?.({
          detected: true,
          message: 'Hold still',
          streak,
          required: requiredFrames,
        })

        if (streak >= requiredFrames) {
          const embedded = await faceService.embedFrame(video)
          if (!embedded.ok) {
            // The recognition model disagreed with the liveness detector about
            // whether there is a usable face. Keep watching rather than fail.
            streak = 0
            lastReason = embedded.reason === 'multiple_faces' ? 'multiple_faces' : 'no_face'
            continue
          }
          return { ok: true, embedding: embedded.embedding, real: bestReal }
        }
      } else {
        // A spoof attempt must not be averaged away by a few good frames.
        streak = 0
        lastReason = liveness.reason

        onProgress?.({
          detected: false,
          message: guidance(liveness.reason),
          streak: 0,
          required: requiredFrames,
        })
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 120))
  }

  return { ok: false, reason: streak > 0 ? lastReason : 'timeout' }
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
