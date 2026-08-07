import { AlertTriangle, Check, Clock, Minus } from 'lucide-react'
import { statusLabel, statusTone } from '@/lib/attendance'
import { cn } from '@/lib/utils'

/**
 * Status is always icon + text, never colour alone — roughly 1 in 12 men has
 * some colour vision deficiency, and this runs in a hospital.
 */
export function StatusPill({ status }: { status: string | null }) {
  const tone = statusTone(status)

  const styles = {
    good: 'bg-success-50 text-success-700',
    warn: 'bg-warn-50 text-warn-700',
    bad: 'bg-danger-50 text-danger-700',
    neutral: 'bg-slate-100 text-slate-500',
  }[tone]

  const Icon = {
    good: Check,
    warn: Clock,
    bad: AlertTriangle,
    neutral: Minus,
  }[tone]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs whitespace-nowrap',
        styles,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      {statusLabel(status)}
    </span>
  )
}
