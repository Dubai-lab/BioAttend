import type { Human, Config, Result } from '@vladmandic/human'

/**
 * Face recognition engine.
 *
 * Everything runs in the browser: the camera feed never leaves the machine,
 * only a 1024-number descriptor does. For hospital data that is the right
 * default, and it also means no GPU server to host.
 *
 * The models are pretrained. Nothing here is ever trained — enrolment simply
 * computes a descriptor and stores it, exactly as fingerprint enrolment
 * stores a template.
 */

const HUMAN_CONFIG: Partial<Config> = {
  // Served from our own origin, copied at build time by scripts/copy-models.mjs.
  // A CDN would fail exactly when hospital internet does.
  modelBasePath: '/models/',
  backend: 'webgl',
  cacheSensitivity: 0,
  warmup: 'none',

  face: {
    enabled: true,
    detector: { rotation: false, maxDetected: 1, minConfidence: 0.4, return: false },
    mesh: { enabled: true },
    iris: { enabled: true },
    // faceres produces the descriptor used for matching.
    description: { enabled: true },
    emotion: { enabled: false },
    // The reason this library was chosen over face-api.js.
    antispoof: { enabled: true },
    liveness: { enabled: true },
  },

  // Nothing else is needed; leaving them on costs load time and frame rate.
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
  segmentation: { enabled: false },
}

let instance: Human | null = null
let loading: Promise<Human> | null = null

/** Load once and reuse — the models are ~13 MB. */
export async function getHuman(): Promise<Human> {
  if (instance) return instance
  if (loading) return loading

  loading = (async () => {
    // Imported dynamically so TensorFlow (~1.6 MB) is a separate chunk. Pages
    // that never touch a camera should not pay for it, and the kiosk should
    // not stall on it while someone is waiting at the sensor.
    const { Human: HumanClass } = await import('@vladmandic/human')
    const human = new HumanClass(HUMAN_CONFIG)
    await human.load()
    await human.warmup()
    instance = human
    return human
  })()

  return loading
}

export interface FaceSample {
  /** 1024-d descriptor. This is what gets stored and compared. */
  embedding: number[]
  /** Detector confidence for the face itself. */
  score: number
  /** 0–1, higher means more likely a real face than a photo or screen. */
  real: number
  /** 0–1 liveness estimate. */
  live: number
  /** Head pose in degrees; used to check the requested angle was actually met. */
  yaw: number
  pitch: number
}

export type FaceRejection =
  | 'no_face'
  | 'multiple_faces'
  | 'low_confidence'
  | 'spoof'
  | 'no_embedding'

export type FaceReading =
  | { ok: true; sample: FaceSample }
  | { ok: false; reason: FaceRejection }

/**
 * Minimum anti-spoof and liveness scores.
 *
 * A photo held up to the camera typically scores well below these. This is
 * the first of three defences against presentation attacks; the others are
 * the active challenge during enrolment and face being a second factor
 * rather than a primary identifier.
 */
export const REAL_THRESHOLD = 0.55
export const LIVE_THRESHOLD = 0.5
export const FACE_CONFIDENCE_THRESHOLD = 0.5

/** Run detection on one video frame and grade what came back. */
export async function readFace(
  human: Human,
  input: HTMLVideoElement | HTMLCanvasElement,
): Promise<FaceReading> {
  const result: Result = await human.detect(input)

  if (!result.face || result.face.length === 0) return { ok: false, reason: 'no_face' }
  if (result.face.length > 1) return { ok: false, reason: 'multiple_faces' }

  const face = result.face[0]

  if ((face.faceScore ?? face.score ?? 0) < FACE_CONFIDENCE_THRESHOLD) {
    return { ok: false, reason: 'low_confidence' }
  }

  const real = face.real ?? 0
  const live = face.live ?? 0
  if (real < REAL_THRESHOLD || live < LIVE_THRESHOLD) {
    return { ok: false, reason: 'spoof' }
  }

  const embedding = face.embedding
  if (!embedding || embedding.length === 0) return { ok: false, reason: 'no_embedding' }

  return {
    ok: true,
    sample: {
      embedding: Array.from(embedding),
      score: face.faceScore ?? face.score ?? 0,
      real,
      live,
      yaw: face.rotation?.angle?.yaw ? toDegrees(face.rotation.angle.yaw) : 0,
      pitch: face.rotation?.angle?.pitch ? toDegrees(face.rotation.angle.pitch) : 0,
    },
  }
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI
}

/**
 * Cosine similarity, 0–1.
 *
 * Face descriptors are ordinary number arrays, so unlike fingerprint
 * templates they can be compared anywhere — in the browser, or in Postgres
 * via pgvector.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  return denominator === 0 ? 0 : dot / denominator
}

export function describeRejection(reason: FaceRejection): string {
  switch (reason) {
    case 'no_face':
      return 'No face detected — look at the camera'
    case 'multiple_faces':
      return 'More than one face in frame — only the staff member should be visible'
    case 'low_confidence':
      return 'Face unclear — move closer and check the lighting'
    case 'spoof':
      return 'This does not look like a live face. A photo or screen cannot be used.'
    case 'no_embedding':
      return 'Could not read facial features — try again'
  }
}
