/**
 * Client for the local face recognition service.
 *
 * Embeddings are computed by InsightFace (ArcFace) running on the kiosk
 * machine rather than in the browser. ArcFace is trained with an angular
 * margin loss that maximises separation between identities — the property
 * that failed when a sibling matched an enrolled face — and it is a Python
 * library that cannot run in a browser.
 *
 *   Browser ──HTTP──▶ 127.0.0.1:8322 ──▶ SCRFD + ArcFace ──▶ 512-d embedding
 *
 * The camera stays in the browser. Only the captured frame crosses to the
 * service, and only an embedding comes back. No image is stored at either end.
 *
 * Anti-spoofing remains in the browser (see engine.ts): InsightFace ships no
 * presentation attack detection, and the browser already has a working one.
 * Frames are gated on liveness before being sent.
 */

const SERVICE_URL = 'http://127.0.0.1:8322'

export class FaceServiceOfflineError extends Error {
  constructor() {
    super(
      'The face recognition service is not running. Start ' +
        'bridge/run-face-service.bat and leave the window open.',
    )
    this.name = 'FaceServiceOfflineError'
  }
}

export interface FaceServiceHealth {
  ok: boolean
  service: string
  model: string
  loaded: boolean
  error: string | null
}

export type EmbedResult =
  | {
      ok: true
      /** 512-d L2-normalised ArcFace embedding. */
      embedding: number[]
      dimensions: number
      /** Detector confidence, 0–1. */
      score: number
      yaw: number
      pitch: number
      /** Proportion of the frame the face occupies. */
      coverage: number
      ms: number
    }
  | {
      ok: false
      reason: 'no_face' | 'multiple_faces' | 'low_confidence' | 'no_image'
      score?: number
      count?: number
      ms?: number
    }

async function call<T>(path: string, body?: unknown, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${SERVICE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    })
    return (await response.json()) as T
  } catch {
    throw new FaceServiceOfflineError()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Grab the current video frame as a JPEG data URL.
 *
 * Downscaled to 640px on the long edge: the detector runs at 640x640, so
 * anything larger is discarded after transfer, and a full-resolution frame
 * makes the request several times bigger for no gain in accuracy.
 */
export function captureFrame(video: HTMLVideoElement, maxEdge = 640): string {
  const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight))
  const width = Math.round(video.videoWidth * scale)
  const height = Math.round(video.videoHeight * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create a canvas context')

  context.drawImage(video, 0, 0, width, height)
  // 0.92 keeps enough detail for recognition; lower starts to cost accuracy.
  return canvas.toDataURL('image/jpeg', 0.92)
}

export const faceService = {
  async health(): Promise<FaceServiceHealth> {
    return call<FaceServiceHealth>('/health', undefined, 4000)
  },

  async isOnline(): Promise<boolean> {
    try {
      return (await faceService.health()).ok
    } catch {
      return false
    }
  },

  /** Load the models. Slow on first call; worth doing before anyone waits. */
  async warmup(): Promise<void> {
    await call('/warmup', {}, 120000)
  },

  /** Compute an embedding from a captured frame. */
  async embed(dataUrl: string): Promise<EmbedResult> {
    return call<EmbedResult>('/embed', { image: dataUrl }, 20000)
  },

  /** Capture from a live video element and embed in one step. */
  async embedFrame(video: HTMLVideoElement): Promise<EmbedResult> {
    return faceService.embed(captureFrame(video))
  },
}

export function describeEmbedFailure(result: Extract<EmbedResult, { ok: false }>): string {
  switch (result.reason) {
    case 'no_face':
      return 'No face detected — look at the camera'
    case 'multiple_faces':
      // Refused rather than resolved: picking the largest face would let
      // someone standing behind be captured instead.
      return 'More than one face in frame — only the staff member should be visible'
    case 'low_confidence':
      return 'Face unclear — move closer and check the lighting'
    case 'no_image':
      return 'No image was captured'
    default:
      return 'Could not read the face'
  }
}
