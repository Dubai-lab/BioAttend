import { cn } from '@/lib/utils'

/**
 * Northcrest General shield mark.
 *
 * Drawn as inline SVG rather than loaded as an image file: it stays crisp at
 * any size, adds no network request, and its colours can follow the surface it
 * sits on. The sidebar is dark and the sign-in panel is light, and a single
 * exported PNG cannot serve both.
 */
export function ShieldMark({
  className,
  tone = 'dark',
}: {
  className?: string
  /** `dark` for light backgrounds, `light` for dark backgrounds. */
  tone?: 'dark' | 'light'
}) {
  // On a dark sidebar a navy shield disappears, so the body lightens and the
  // accent brightens to keep the silhouette legible.
  const body = tone === 'dark' ? 'var(--color-shell-900)' : 'var(--color-brand-700)'
  const accent = tone === 'dark' ? 'var(--color-brand-400)' : 'var(--color-brand-300)'

  return (
    <svg
      viewBox="0 0 64 72"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="Northcrest General"
    >
      {/* Shield body */}
      <path
        d="M32 2 L60 12 V38 C60 54.5 47.5 65.5 32 70 C16.5 65.5 4 54.5 4 38 V12 Z"
        fill={body}
      />
      {/* Chevron across the crown */}
      <path d="M4 12 L32 2 L60 12 V21 L32 11 L4 21 Z" fill={accent} />
      {/* Cross */}
      <rect x="26.5" y="26" width="11" height="30" rx="1.5" fill="#ffffff" />
      <rect x="17" y="35.5" width="30" height="11" rx="1.5" fill="#ffffff" />
    </svg>
  )
}

/**
 * Full lockup: shield plus wordmark.
 *
 * "Northcrest" is weighted heavier than "General" and BIOATTENDANCE is set
 * small and tracked beneath, matching the approved mark.
 */
export function Logo({
  className,
  tone = 'dark',
  size = 'md',
}: {
  className?: string
  tone?: 'dark' | 'light'
  size?: 'sm' | 'md'
}) {
  const shieldSize = size === 'sm' ? 'h-8' : 'h-10'
  const nameSize = size === 'sm' ? 'text-sm' : 'text-base'
  const subSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]'

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <ShieldMark tone={tone} className={shieldSize} />

      <div className="leading-tight">
        <p className={cn(nameSize, 'whitespace-nowrap font-semibold tracking-tight')}>
          <span className={tone === 'light' ? 'text-white' : 'text-slate-900'}>
            Northcrest
          </span>{' '}
          <span className={tone === 'light' ? 'text-slate-400' : 'text-slate-500'}>
            General
          </span>
        </p>
        <p
          className={cn(
            subSize,
            'font-semibold uppercase tracking-[0.18em] text-brand-400',
          )}
        >
          BioAttendance
        </p>
      </div>
    </div>
  )
}
