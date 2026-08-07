import { useState } from 'react'
import { Fingerprint, Check, Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import {
  BridgeOfflineError,
  bridge,
  type EnrollStage,
} from '@/lib/fingerprint/bridge'
import { cn } from '@/lib/utils'
import type { FingerPosition } from '@/types/database'

/**
 * Four fingers per staff member: both thumbs, both index fingers.
 *
 * Two would work, but hospital staff lose ridge detail to constant
 * hand-washing and sanitiser, and hands get bandaged. Four enrolments is a
 * few extra minutes once, against a person who cannot clock in for a week.
 */
export const FINGERS: { position: FingerPosition; label: string }[] = [
  { position: 'left_thumb', label: 'Left thumb' },
  { position: 'left_index', label: 'Left index' },
  { position: 'right_index', label: 'Right index' },
  { position: 'right_thumb', label: 'Right thumb' },
]

export interface CapturedFinger {
  position: FingerPosition
  template: string
  quality: number
}

interface FingerCaptureProps {
  captured: CapturedFinger[]
  onCaptured: (finger: CapturedFinger) => void
  minQuality: number
  disabled?: boolean
  disabledReason?: string
}

export function FingerCapture({
  captured,
  onCaptured,
  minQuality,
  disabled = false,
  disabledReason,
}: FingerCaptureProps) {
  const [active, setActive] = useState<FingerPosition | null>(null)
  const [stage, setStage] = useState<EnrollStage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lowQuality, setLowQuality] = useState<number | null>(null)

  const capturedFor = (position: FingerPosition) =>
    captured.find((item) => item.position === position)

  async function capture(position: FingerPosition) {
    setActive(position)
    setError(null)
    setLowQuality(null)
    setStage(null)

    try {
      const result = await bridge.enrollStepwise(3, setStage)

      if (result.quality < minQuality) {
        // Reject rather than store a weak template — a bad enrolment is a
        // staff member who fails to clock in every morning from now on.
        setLowQuality(result.quality)
        return
      }

      onCaptured({ position, template: result.template, quality: result.quality })
    } catch (err) {
      setError(
        err instanceof BridgeOfflineError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err),
      )
    } finally {
      setActive(null)
      setStage(null)
    }
  }

  return (
    <div className="space-y-4">
      {disabled && disabledReason && (
        <div className="flex items-start gap-2.5 rounded-control border border-warn-500/20 bg-warn-50 px-4 py-3 text-sm text-warn-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{disabledReason}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FINGERS.map((finger) => {
          const done = capturedFor(finger.position)
          const isActive = active === finger.position

          return (
            <button
              key={finger.position}
              type="button"
              disabled={disabled || active !== null}
              onClick={() => void capture(finger.position)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-card border px-3 py-4 text-center transition-colors',
                done
                  ? 'border-brand-300 bg-brand-50'
                  : isActive
                    ? 'border-brand-500 bg-white ring-2 ring-brand-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                (disabled || (active !== null && !isActive)) &&
                  'cursor-not-allowed opacity-50',
              )}
            >
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-full',
                  done ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400',
                )}
              >
                {isActive ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : done ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Fingerprint className="size-4" aria-hidden="true" />
                )}
              </span>

              <span className="text-sm font-medium text-slate-800">{finger.label}</span>

              <span className="id-text text-xs text-muted">
                {done ? `Quality ${done.quality}` : isActive ? 'Scanning…' : 'Not captured'}
              </span>

              {done && (
                <span className="flex items-center gap-1 text-[11px] text-brand-700">
                  <RotateCcw className="size-3" aria-hidden="true" />
                  Recapture
                </span>
              )}
            </button>
          )
        })}
      </div>

      {stage && <CaptureProgress stage={stage} />}

      {lowQuality !== null && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-control border border-warn-500/20 bg-warn-50 px-4 py-3 text-sm text-warn-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">
              Quality {lowQuality} is below the minimum of {minQuality} — not saved
            </p>
            <p className="mt-0.5 opacity-90">
              Wipe the sensor and the fingertip, press flat, and cover more of the
              sensor. A weak template means failed check-ins every morning.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-control border border-danger-500/20 bg-danger-50 px-4 py-3 text-sm text-danger-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}
    </div>
  )
}

function CaptureProgress({ stage }: { stage: EnrollStage }) {
  const instruction: Record<EnrollStage['kind'], string> = {
    waiting: `Place the finger on the sensor — scan ${stage.pass} of ${stage.of}`,
    captured: `Scan ${stage.pass} of ${stage.of} captured`,
    lift: 'Lift the finger, then place the same finger again',
    merging: 'Combining scans into one template…',
    done: 'Done',
  }

  const isLift = stage.kind === 'lift'

  return (
    <div
      className={cn(
        'rounded-control px-4 py-4 transition-colors',
        isLift ? 'bg-warn-50' : 'bg-brand-50',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <Fingerprint
          className={cn(
            'size-6 shrink-0',
            stage.kind === 'waiting' && 'animate-pulse',
            isLift ? 'text-warn-700' : 'text-brand-700',
          )}
          aria-hidden="true"
        />
        <p
          className={cn(
            'text-sm font-medium',
            isLift ? 'text-warn-700' : 'text-brand-800',
          )}
        >
          {instruction[stage.kind]}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2 pl-9">
        {Array.from({ length: stage.of }, (_, index) => {
          const number = index + 1
          const complete =
            number < stage.pass ||
            (number === stage.pass && stage.kind !== 'waiting') ||
            stage.kind === 'merging' ||
            stage.kind === 'done'
          const current = number === stage.pass && stage.kind === 'waiting'

          return (
            <span
              key={number}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                complete ? 'bg-brand-600' : current ? 'bg-brand-300' : 'bg-slate-200',
              )}
            />
          )
        })}
      </div>
    </div>
  )
}
