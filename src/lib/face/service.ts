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
 *   Phone ──HTTPS──▶ Cloudflare tunnel ──▶ the same service on the PC
 *
 * The camera stays in the browser. Only the captured frame crosses to the
 * service, and only an embedding comes back. No image is stored at either end.
 *
 * Anti-spoofing remains in the browser (see engine.ts): InsightFace ships no
 * presentation attack detection, and the browser already has a working one.
 * Frames are gated on liveness before being sent.
 */

const LOCAL_SERVICE_URL = 'http://127.0.0.1:8322'
const STORAGE_KEY = 'bioattend.face.serviceUrl'

/**
 * Where bridge/face_tunnel.py publishes the tunnel's current address.
 *
 * A free tunnel is given a new address every time it starts, so the address
 * cannot be built into the site. The launcher writes it to this public file
 * instead, and every device reads it from there — nothing to type on a phone.
 */
const PUBLISHED_URL =
  `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/bioattend-runtime/face-service.json`

/** The address chosen automatically for this page load, once known. */
let resolved: string | null = null
let resolving: Promise<string> | null = null

function manualUrl(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * A phone has no face service of its own — 127.0.0.1 there is the phone. It
 * is not probed, both because it cannot answer and because asking an https
 * page to reach the local network raises a permission prompt on Android.
 */
function isPhone(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

async function answers(base: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${base}/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function publishedUrl(): Promise<string | null> {
  try {
    // The query string defeats the CDN: a cached copy is a dead tunnel.
    const response = await fetch(`${PUBLISHED_URL}?t=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return null
    const body = (await response.json()) as { url?: string | null }
    if (!body.url) return null
    const url = new URL(body.url)
    return url.protocol === 'https:' ? url.origin : null
  } catch {
    return null
  }
}

/**
 * Decide which face service this browser should use.
 *
 *   1. An address entered by hand under Devices always wins.
 *   2. On a computer, the service on this machine if it is answering.
 *   3. Otherwise the tunnel address the PC has published.
 *
 * The answer is remembered for the page load and forgotten when a call fails,
 * so a restarted tunnel is picked up without a refresh.
 */
async function resolveBase(): Promise<string> {
  const manual = manualUrl()
  if (manual) return manual
  if (resolved) return resolved

  resolving ??= (async () => {
    try {
      if (!isPhone() && (await answers(LOCAL_SERVICE_URL, 1500))) {
        resolved = LOCAL_SERVICE_URL
      } else {
        resolved = await publishedUrl()
      }
      return resolved ?? LOCAL_SERVICE_URL
    } finally {
      resolving = null
    }
  })()

  return resolving
}

/** The address in use right now. Local until resolution has run. */
export function getFaceServiceUrl(): string {
  return manualUrl() ?? resolved ?? LOCAL_SERVICE_URL
}

export function isRemoteFaceService(): boolean {
  return getFaceServiceUrl() !== LOCAL_SERVICE_URL
}

/** True when the address was typed in under Devices rather than found. */
export function isManualFaceService(): boolean {
  return manualUrl() !== null
}

/**
 * Point this browser at a specific tunnel, or back to automatic with ''.
 *
 * Returns the address stored, or null if it was not usable. Only https is
 * accepted: the site is served over https and a browser will refuse to send
 * a camera frame from it to a plain http address anyway.
 */
export function setFaceServiceUrl(input: string): string | null {
  const trimmed = input.trim()
  resolved = null

  if (trimmed === '') {
    localStorage.removeItem(STORAGE_KEY)
    return LOCAL_SERVICE_URL
  }

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    if (url.protocol !== 'https:') return null
    localStorage.setItem(STORAGE_KEY, url.origin)
    return url.origin
  } catch {
    return null
  }
}

export class FaceServiceOfflineError extends Error {
  constructor() {
    super(
      isPhone() || isManualFaceService()
        ? 'The face recognition service cannot be reached. On the PC, check ' +
            'that run-face-service.bat and run-face-tunnel.bat are both ' +
            'running, then try again.'
        : 'The face recognition service is not running. Start ' +
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
    const base = await resolveBase()
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    })
    return (await response.json()) as T
  } catch {
    // Forget the automatic choice: the tunnel may have restarted on a new
    // address, and the next call should look it up again.
    resolved = null
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
