import { Delete, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Numeric entry for the face fallback.
 *
 * The person states who they are, then face confirms it. That turns the
 * question from "who is this?" (which face answers badly) into "is this
 * David?" (which it answers well).
 *
 * SIZING
 *
 * Everything here is measured in viewport height rather than fixed pixels.
 * A kiosk screen that scrolls hides its own Continue button, and someone
 * standing at a station has no reason to suspect there is anything below the
 * fold — they simply conclude it is broken. Scaling to the viewport keeps the
 * whole keypad visible on a laptop screen and on a mounted display alike.
 */
export function StaffNumberEntry({
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back']

  function press(key: string) {
    if (key === 'clear') return onChange('')
    if (key === 'back') return onChange(value.slice(0, -1))
    if (value.length >= 6) return
    onChange(value + key)
  }

  return (
    <div className="flex h-full max-h-screen flex-col items-center justify-center gap-[2vh] py-[2vh]">
      <div className="text-center">
        <p
          className="font-semibold leading-tight text-white"
          style={{ fontSize: 'clamp(1.5rem, 4vh, 2.75rem)' }}
        >
          Enter your staff number
        </p>
        <p
          className="mt-1 text-slate-400"
          style={{ fontSize: 'clamp(0.85rem, 1.8vh, 1.15rem)' }}
        >
          Then look at the camera to confirm it is you
        </p>
      </div>

      {/* Entered digits */}
      <div
        className="id-text flex items-center justify-center rounded-card border-2 border-slate-700 bg-shell-900 px-8 tracking-widest text-white"
        style={{
          height: 'clamp(3rem, 9vh, 5rem)',
          minWidth: 'clamp(14rem, 26vw, 20rem)',
          fontSize: 'clamp(1.5rem, 5vh, 3rem)',
        }}
        aria-live="polite"
        aria-label="Staff number entered"
      >
        {value || <span className="text-slate-600">— — — —</span>}
      </div>

      <div className="grid grid-cols-3 gap-[1.2vh]">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            className={cn(
              'id-text flex items-center justify-center rounded-card font-medium transition-colors',
              key === 'clear' || key === 'back'
                ? 'bg-shell-800 text-slate-400 hover:bg-shell-900'
                : 'bg-shell-800 text-white hover:bg-brand-700',
            )}
            style={{
              width: 'clamp(3.25rem, 9vh, 5rem)',
              height: 'clamp(3.25rem, 9vh, 5rem)',
              fontSize: 'clamp(1.1rem, 3.4vh, 1.9rem)',
            }}
            aria-label={key === 'back' ? 'Delete' : key === 'clear' ? 'Clear' : key}
          >
            {key === 'back' ? (
              <Delete className="size-[2.6vh] min-h-4 min-w-4" aria-hidden="true" />
            ) : key === 'clear' ? (
              <X className="size-[2.6vh] min-h-4 min-w-4" aria-hidden="true" />
            ) : (
              key
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-card border border-slate-700 text-slate-300 hover:bg-shell-900"
          style={{
            padding: 'clamp(0.5rem, 1.6vh, 1rem) clamp(1.25rem, 3vw, 2rem)',
            fontSize: 'clamp(0.9rem, 2.2vh, 1.25rem)',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={value.length < 3}
          className="rounded-card bg-brand-600 font-medium text-white hover:bg-brand-700 disabled:opacity-40"
          style={{
            padding: 'clamp(0.5rem, 1.6vh, 1rem) clamp(1.75rem, 4vw, 2.5rem)',
            fontSize: 'clamp(0.9rem, 2.2vh, 1.25rem)',
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
