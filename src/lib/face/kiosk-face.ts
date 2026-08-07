import { supabase } from '@/lib/supabase'
import { getHuman, readFace, type FaceRejection } from '@/lib/face/engine'
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
  reason: FaceRejection | 'timeout'
}

export interface FaceScanSuccess {
  ok: true
  embedding: number[]
  real: number
}

/**
 * Watch the camera until a live, non-spoofed face appears.
 *
 * Requires several consecutive good frames rather than one. A single frame can
 * catch a photo mid-wave or a face half out of shot; consecutive frames cannot.
 */
export async function scanForFace(
  video: HTMLVideoElement,
  { timeoutMs = 8000, requiredFrames = 3 }: { timeoutMs?: number; requiredFrames?: number } = {},
): Promise<FaceScanSuccess | FaceScanFailure> {
  const human = await getHuman()
  const deadline = Date.now() + timeoutMs

  let streak = 0
  let best: { embedding: number[]; real: number } | null = null
  let lastReason: FaceRejection = 'no_face'

  while (Date.now() < deadline) {
    if (video.readyState >= 2) {
      const reading = await readFace(human, video)

      if (reading.ok) {
        streak += 1
        if (!best || reading.sample.real > best.real) {
          best = { embedding: reading.sample.embedding, real: reading.sample.real }
        }
        if (streak >= requiredFrames && best) {
          return { ok: true, embedding: best.embedding, real: best.real }
        }
      } else {
        // A spoof attempt should not be averaged away by a few good frames.
        streak = 0
        lastReason = reading.reason
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
