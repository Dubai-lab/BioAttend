import type { Human, Config, Result } from '@vladmandic/human'

/**
 * Liveness and anti-spoofing.
 *
 * This module no longer produces embeddings. Recognition moved to InsightFace
 * (ArcFace) running in a local service — see service.ts — because its angular
 * margin training separates identities far better, which is the property that
 * failed when a sibling matched an enrolled face.
 *
 * What stays here is the part InsightFace does not provide at all: deciding
 * whether the camera is looking at a live person or at a photograph. Swapping
 * recognition without keeping this would have traded a real defence for
 * accuracy.
 *
 * Only three models are loaded now — detector, anti-spoof and liveness. The
 * descriptor and iris models are gone, taking about 9 MB off the kiosk's first
 * load.
 */

const HUMAN_CONFIG: Partial<Config> = {
  modelBasePath: '/models/',
  backend: 'webgl',
  cacheSensitivity: 0,
  warmup: 'none',

  face: {
    enabled: true,
    detector: { rotation: false, maxDetected: 1, minConfidence: 0.4, return: false },
    // Mesh stays on: the anti-spoof and liveness models operate on an aligned
    // face crop, and alignment comes from the mesh.
    mesh: { enabled: true },
    iris: { enabled: false },
    // Recognition is InsightFace's job now.
    description: { enabled: false },
    emotion: { enabled: false },
    antispoof: { enabled: true },
    liveness: { enabled: true },
  },

  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
  segmentation: { enabled: false },
}

let instance: Human | null = null
let loading: Promise<Human> | null = null

export async function getHuman(): Promise<Human> {
  if (instance) return instance
  if (loading) return loading

  loading = (async () => {
    // Dynamic import so TensorFlow lands in its own chunk and pages that never
    // open a camera do not pay for it.
    const { Human: HumanClass } = await import('@vladmandic/human')
    const human = new HumanClass(HUMAN_CONFIG)
    await human.load()
    await human.warmup()
    instance = human
    return human
  })()

  return loading
}

/**
 * Minimum anti-spoof and liveness scores.
 *
 * A photograph or a screen typically scores well below these. This is the
 * first of three defences against presentation attacks; the others are the
 * active challenge during enrolment and face being a fallback rather than the
 * primary identifier.
 */
export const REAL_THRESHOLD = 0.55
export const LIVE_THRESHOLD = 0.5
export const FACE_CONFIDENCE_THRESHOLD = 0.5

export type LivenessRejection =
  | 'no_face'
  | 'multiple_faces'
  | 'low_confidence'
  | 'spoof'

export interface LivenessReading {
  /** Detector confidence for the face. */
  score: number
  /** 0–1; higher means more likely a real face than a photo or screen. */
  real: number
  /** 0–1 liveness estimate. */
  live: number
}

export type LivenessResult =
  | { ok: true; reading: LivenessReading }
  | { ok: false; reason: LivenessRejection }

/**
 * Is the camera looking at a live person?
 *
 * Called continuously during preview so the operator sees the verdict before
 * capturing, and again as a gate immediately before a frame is sent for
 * recognition.
 */
export async function checkLiveness(
  human: Human,
  input: HTMLVideoElement | HTMLCanvasElement,
): Promise<LivenessResult> {
  const result: Result = await human.detect(input)

  if (!result.face || result.face.length === 0) return { ok: false, reason: 'no_face' }
  if (result.face.length > 1) return { ok: false, reason: 'multiple_faces' }

  const face = result.face[0]
  const score = face.faceScore ?? face.score ?? 0

  if (score < FACE_CONFIDENCE_THRESHOLD) return { ok: false, reason: 'low_confidence' }

  const real = face.real ?? 0
  const live = face.live ?? 0
  if (real < REAL_THRESHOLD || live < LIVE_THRESHOLD) return { ok: false, reason: 'spoof' }

  return { ok: true, reading: { score, real, live } }
}

export function describeRejection(reason: LivenessRejection): string {
  switch (reason) {
    case 'no_face':
      return 'No face detected — look at the camera'
    case 'multiple_faces':
      return 'More than one face in frame — only the staff member should be visible'
    case 'low_confidence':
      return 'Face unclear — move closer and check the lighting'
    case 'spoof':
      return 'This does not look like a live face. A photo or screen cannot be used.'
  }
}
