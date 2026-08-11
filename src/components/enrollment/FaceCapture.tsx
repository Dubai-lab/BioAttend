import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Camera,
  Check,
  Loader2,
  ScanFace,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'
import {
  checkLiveness,
  describeRejection,
  getHuman,
  type LivenessReading,
} from '@/lib/face/engine'
import { describeEmbedFailure, faceService } from '@/lib/face/service'
import { cn } from '@/lib/utils'

/**
 * Five angles per staff member.
 *
 * One frontal descriptor works in a studio. It does not work at 6am in a
 * corridor when someone approaches slightly off-centre, so enrolment covers
 * the poses actually seen in use.
 *
 * Poses are measured RELATIVE to the person's own straight-ahead reading, not
 * against absolute degrees. A laptop webcam sits below eye level and biases
 * pitch by 10-15° for everyone, so absolute limits reject people for holding
 * their head normally.
 */
export const FACE_ANGLES = [
  { key: 'front', label: 'Look straight ahead', axis: null, hint: 'Face the camera' },
  { key: 'left', label: 'Turn slightly left', axis: 'yaw', hint: 'Turn your head to one side' },
  { key: 'right', label: 'Turn slightly right', axis: 'yaw', hint: 'Turn to the other side' },
  { key: 'up', label: 'Tilt your head up a little', axis: 'pitch', hint: 'Chin up slightly' },
  { key: 'down', label: 'Tilt your head down a little', axis: 'pitch', hint: 'Chin down slightly' },
] as const

export type FaceAngle = (typeof FACE_ANGLES)[number]['key']

/** Minimum movement away from the baseline, in degrees. */
const YAW_DELTA = 10
const PITCH_DELTA = 8

export interface CapturedFace {
  angle: FaceAngle
  embedding: number[]
  quality: number
  /** Pose at capture, kept so opposite pairs can be checked against each other. */
  yaw: number
  pitch: number
}

interface FaceCaptureProps {
  captured: CapturedFace[]
  onCaptured: (face: CapturedFace) => void
  disabled?: boolean
  disabledReason?: string
}

export function FaceCapture({
  captured,
  onCaptured,
  disabled = false,
  disabledReason,
}: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [ready, setReady] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState<{ reading?: LivenessReading; message?: string } | null>(null)
  // Pose is measured by the recognition service, not the browser, so the
  // readiness indicator only updates when a capture is attempted. The live
  // overlay still shows whether the face is real.
  const [pose, setPose] = useState<{ yaw: number; pitch: number } | null>(null)
  const [busy, setBusy] = useState<FaceAngle | null>(null)

  const capturedFor = (angle: FaceAngle) => captured.find((item) => item.angle === angle)
  const baseline = capturedFor('front')

  // --- camera + models ------------------------------------------------------
  const start = useCallback(async () => {
    setError(null)
    setLoadingModels(true)

    try {
      await getHuman()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setReady(true)
    } catch (err) {
      setError(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access and try again.'
          : err instanceof Error
            ? err.message
            : String(err),
      )
    } finally {
      setLoadingModels(false)
    }
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setReady(false)
    setLive(null)
  }, [])

  useEffect(() => stop, [stop])

  // --- continuous preview ---------------------------------------------------
  useEffect(() => {
    if (!ready) return
    let cancelled = false

    async function tick() {
      const human = await getHuman()
      while (!cancelled) {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          const result = await checkLiveness(human, videoRef.current)
          if (cancelled) break
          setLive(
            result.ok
              ? { reading: result.reading }
              : { message: describeRejection(result.reason) },
          )
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }

    void tick()
    return () => {
      cancelled = true
    }
  }, [ready])

  /**
   * Is the current head position acceptable for this angle?
   *
   * Returns null when it is, or a human instruction when it is not — the same
   * function drives both the live readiness indicator and the capture guard,
   * so the button never lies about whether pressing will work.
   */
  function poseProblem(
    angle: FaceAngle,
    sample: { yaw: number; pitch: number } | undefined,
  ): string | null {
    if (!sample) return null // pose is only known once a frame is analysed

    const spec = FACE_ANGLES.find((item) => item.key === angle)!
    if (spec.axis === null) return null // front sets the baseline; any pose is fine

    if (!baseline) return 'Capture "Look straight ahead" first'

    if (spec.axis === 'yaw') {
      const delta = sample.yaw - baseline.yaw
      if (Math.abs(delta) < YAW_DELTA) return 'Turn your head further'

      // Left and right must be genuine opposites, otherwise both "sides" can
      // be the same turn and the extra capture adds nothing.
      const opposite = capturedFor(angle === 'left' ? 'right' : 'left')
      if (opposite) {
        const oppositeDelta = opposite.yaw - baseline.yaw
        if (Math.sign(delta) === Math.sign(oppositeDelta)) return 'Turn the other way'
      }
      return null
    }

    const delta = sample.pitch - baseline.pitch
    if (Math.abs(delta) < PITCH_DELTA) return 'Tilt your head further'

    const opposite = capturedFor(angle === 'up' ? 'down' : 'up')
    if (opposite) {
      const oppositeDelta = opposite.pitch - baseline.pitch
      if (Math.sign(delta) === Math.sign(oppositeDelta)) return 'Tilt the other way'
    }
    return null
  }

  async function capture(angle: FaceAngle) {
    if (!videoRef.current) return
    setBusy(angle)
    setError(null)

    try {
      // 1. Liveness gate, in the browser. A photograph never reaches the
      //    recognition service.
      const human = await getHuman()
      const liveness = await checkLiveness(human, videoRef.current)

      if (!liveness.ok) {
        setError(describeRejection(liveness.reason))
        return
      }

      // 2. Embedding, from InsightFace on the local service. The frame is
      //    posted; only the vector comes back.
      const embedded = await faceService.embedFrame(videoRef.current)

      if (!embedded.ok) {
        setError(describeEmbedFailure(embedded))
        return
      }

      setPose({ yaw: embedded.yaw, pitch: embedded.pitch })

      // 3. Confirm the requested head position was actually adopted, using
      //    the pose the recognition model measured.
      const problem = poseProblem(angle, embedded)
      if (problem) {
        setError(problem)
        return
      }

      onCaptured({
        angle,
        embedding: embedded.embedding,
        quality: embedded.score,
        yaw: embedded.yaw,
        pitch: embedded.pitch,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      {disabled && disabledReason && (
        <Notice tone="warn" icon={AlertCircle}>
          {disabledReason}
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-[320px_1fr]">
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-shell-950">
            <video
              ref={videoRef}
              playsInline
              muted
              className={cn('size-full -scale-x-100 object-cover', !ready && 'invisible')}
            />

            {!ready && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                <ScanFace className="size-8 text-slate-600" aria-hidden="true" />
                <p className="px-4 text-xs text-slate-400">
                  {loadingModels ? 'Loading face models…' : 'Camera is off'}
                </p>
              </div>
            )}

            {ready && live && <LiveOverlay live={live} pose={pose} baseline={baseline} />}
          </div>

          <button
            type="button"
            onClick={() => (ready ? stop() : void start())}
            disabled={disabled || loadingModels}
            className={cn(
              'mt-3 flex w-full items-center justify-center gap-2 rounded-control px-4 py-2 text-sm font-medium transition-colors',
              ready
                ? 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                : 'bg-brand-600 text-white hover:bg-brand-700',
              (disabled || loadingModels) && 'cursor-not-allowed opacity-60',
            )}
          >
            {loadingModels ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Camera className="size-4" aria-hidden="true" />
            )}
            {loadingModels ? 'Loading models…' : ready ? 'Stop camera' : 'Start camera'}
          </button>
        </div>

        <div className="space-y-2">
          {FACE_ANGLES.map((spec) => {
            const done = capturedFor(spec.key)
            const isBusy = busy === spec.key
            // Pose is measured by the recognition service, so readiness here
            // reflects liveness only. If the head position is wrong the
            // capture is refused with an explanation rather than pre-empted.
            const blocked = !ready
              ? 'Camera is off'
              : live?.message
                ? 'Waiting for a clear, live face'
                : spec.axis !== null && !baseline
                  ? 'Capture "Look straight ahead" first'
                  : null
            const problem = blocked
            const canCapture = ready && !blocked && !busy && !disabled

            return (
              <button
                key={spec.key}
                type="button"
                disabled={disabled || !ready || busy !== null}
                onClick={() => void capture(spec.key)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-control border px-3 py-2.5 text-left transition-colors',
                  done
                    ? 'border-brand-300 bg-brand-50'
                    : canCapture
                      ? 'border-brand-500 bg-white ring-2 ring-brand-500/20'
                      : 'border-slate-200 bg-white',
                  (disabled || !ready) && 'opacity-50',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full',
                    done
                      ? 'bg-brand-600 text-white'
                      : canCapture
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-slate-100 text-slate-400',
                  )}
                >
                  {isBusy ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : done ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    <ScanFace className="size-3.5" aria-hidden="true" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-800">
                    {spec.label}
                  </span>
                  <span
                    className={cn(
                      'block text-xs',
                      done
                        ? 'text-brand-700'
                        : canCapture
                          ? 'font-medium text-brand-700'
                          : 'text-muted',
                    )}
                  >
                    {done
                      ? `Captured · quality ${(done.quality * 100).toFixed(0)}`
                      : canCapture
                        ? 'Ready — press to capture'
                        : (problem ?? spec.hint)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <Notice tone="danger" icon={AlertCircle}>
          {error}
        </Notice>
      )}

      <p className="text-xs text-muted">
        Only the mathematical descriptor is stored — never a photograph. Anti-spoof and
        liveness checks run on every frame, so a printed photo or a phone screen is
        rejected before it can be captured.
      </p>
    </div>
  )
}

function LiveOverlay({
  live,
  pose,
  baseline,
}: {
  live: { reading?: LivenessReading; message?: string }
  pose: { yaw: number; pitch: number } | null
  baseline: CapturedFace | undefined
}) {
  if (live.message) {
    return (
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-danger-700/85 px-3 py-2 text-xs text-white">
        <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{live.message}</span>
      </div>
    )
  }

  if (!live.reading) return null
  const { real, live: liveness } = live.reading

  // Pose is from the most recent capture, not the live frame — the browser no
  // longer measures it. Once a baseline exists, movement matters more than
  // absolute angle.
  const yawText = pose
    ? `${(baseline ? pose.yaw - baseline.yaw : pose.yaw).toFixed(0)}°`
    : '—'
  const pitchText = pose
    ? `${(baseline ? pose.pitch - baseline.pitch : pose.pitch).toFixed(0)}°`
    : '—'

  return (
    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-success-700/85 px-3 py-2 text-xs text-white">
      <span className="flex items-center gap-1.5">
        <ShieldCheck className="size-3.5" aria-hidden="true" />
        Live face
      </span>
      <span className="id-text opacity-90">
        real {(real * 100).toFixed(0)} · live {(liveness * 100).toFixed(0)} ·{' '}
        {baseline ? 'Δ' : ''}yaw {yawText} ·{' '}
        {baseline ? 'Δ' : ''}pitch {pitchText}
      </span>
    </div>
  )
}

function Notice({
  tone,
  icon: Icon,
  children,
}: {
  tone: 'warn' | 'danger'
  icon: typeof AlertCircle
  children: React.ReactNode
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-control border px-4 py-3 text-sm',
        tone === 'warn'
          ? 'border-warn-500/20 bg-warn-50 text-warn-700'
          : 'border-danger-500/20 bg-danger-50 text-danger-700',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  )
}
