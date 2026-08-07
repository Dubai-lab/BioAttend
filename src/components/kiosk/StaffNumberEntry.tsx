import { Delete, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Numeric entry for the face fallback.
 *
 * The person states who they are, then face confirms it. That turns the
 * question from "who is this?" (which face answers badly) into "is this
 * David?" (which it answers well).
 *
 * Sized for a touchscreen and for someone standing, not seated at a desk.
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
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <p className="kiosk-headline text-white">Enter your staff number</p>
        <p className="kiosk-subhead mt-3">
          Then look at the camera to confirm it is you
        </p>
      </div>

      {/* Entered digits */}
      <div
        className="id-text flex h-24 min-w-80 items-center justify-center rounded-card border-2 border-slate-700 bg-shell-900 px-8 text-5xl tracking-widest text-white"
        aria-live="polite"
        aria-label="Staff number entered"
      >
        {value || <span className="text-slate-600">— — — —</span>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            className={cn(
              'id-text flex size-20 items-center justify-center rounded-card text-3xl font-medium transition-colors',
              key === 'clear' || key === 'back'
                ? 'bg-shell-800 text-slate-400 hover:bg-shell-900'
                : 'bg-shell-800 text-white hover:bg-brand-700',
            )}
            aria-label={key === 'back' ? 'Delete' : key === 'clear' ? 'Clear' : key}
          >
            {key === 'back' ? (
              <Delete className="size-7" aria-hidden="true" />
            ) : key === 'clear' ? (
              <X className="size-7" aria-hidden="true" />
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
          className="rounded-card border border-slate-700 px-8 py-4 text-xl text-slate-300 hover:bg-shell-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={value.length < 3}
          className="rounded-card bg-brand-600 px-10 py-4 text-xl font-medium text-white hover:bg-brand-700 disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
