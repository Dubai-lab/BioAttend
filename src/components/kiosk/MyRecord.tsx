import { format } from 'date-fns'
import { CheckCircle2, Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AttendanceRecordRow {
  shift_date: string
  check_in_at: string | null
  check_in_status: string | null
  check_in_method: string | null
  check_out_at: string | null
  check_out_status: string | null
  requires_approval: boolean
  shift_name: string | null
}

export interface MyRecordData {
  staff_name: string
  staff_no: string
  days: number
  records: AttendanceRecordRow[]
}

/**
 * A staff member's own recent attendance, shown at the kiosk.
 *
 * Sized between the two densities the rest of the system uses: larger than
 * the console because it is read standing, smaller than the check-in screens
 * because this is a list to scan rather than a single verdict to glance at.
 *
 * Match scores are deliberately absent. They are evaluation data, and showing
 * a nurse that she matched at 0.83 invites an argument about a number nobody
 * can act on.
 */
export function MyRecord({
  data,
  onClose,
}: {
  data: MyRecordData
  onClose: () => void
}) {
  const present = data.records.filter((row) => row.check_in_at).length
  const flagged = data.records.filter((row) => row.requires_approval).length

  return (
    <div className="flex h-full w-full max-w-3xl flex-col gap-4 py-[3vh]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-2xl font-semibold text-white">{data.staff_name}</p>
          <p className="id-text text-sm text-slate-400">
            {data.staff_no} · last {data.days} days
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 rounded-card border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-shell-900"
        >
          <X className="size-4" aria-hidden="true" />
          Done
        </button>
      </div>

      <div className="flex gap-3">
        <Tile label="Days recorded" value={present} />
        <Tile label="Awaiting review" value={flagged} tone={flagged ? 'warn' : 'neutral'} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-card border border-shell-800">
        {data.records.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
            <Clock className="size-6 text-slate-600" aria-hidden="true" />
            <p className="text-slate-300">No attendance recorded yet</p>
            <p className="text-sm text-slate-500">
              Records appear here after your first check-in.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-shell-800">
            {data.records.map((row) => (
              <li
                key={row.shift_date}
                className="flex items-center gap-4 px-4 py-3 text-sm"
              >
                <span className="id-text w-24 shrink-0 text-slate-300">
                  {format(new Date(row.shift_date), 'EEE d MMM')}
                </span>

                <span className="w-28 shrink-0 text-slate-400">
                  {row.shift_name ?? 'No shift'}
                </span>

                <span className="id-text w-16 shrink-0 text-white">
                  {row.check_in_at ? format(new Date(row.check_in_at), 'HH:mm') : '—'}
                </span>
                <span className="id-text w-16 shrink-0 text-white">
                  {row.check_out_at ? format(new Date(row.check_out_at), 'HH:mm') : '—'}
                </span>

                <span className="flex-1">
                  <StatusChip
                    status={row.check_in_status}
                    pending={row.requires_approval}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-slate-600">
        Contact your supervisor if anything here looks wrong.
      </p>
    </div>
  )
}

function StatusChip({ status, pending }: { status: string | null; pending: boolean }) {
  const label =
    {
      on_time: 'On time',
      late: 'Late',
      late_unapproved: 'Late',
      unscheduled: 'Unscheduled',
    }[status ?? ''] ?? '—'

  const good = status === 'on_time'

  return (
    <span className="flex items-center gap-2">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
          good ? 'bg-success-500/15 text-success-500' : 'bg-warn-500/15 text-warn-500',
        )}
      >
        {good && <CheckCircle2 className="size-3" aria-hidden="true" />}
        {label}
      </span>
      {pending && (
        <span className="text-xs text-slate-500">awaiting supervisor</span>
      )}
    </span>
  )
}

function Tile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number
  tone?: 'neutral' | 'warn'
}) {
  return (
    <div className="flex-1 rounded-card bg-shell-900 px-4 py-3">
      <p
        className={cn(
          'id-text text-2xl font-semibold',
          tone === 'warn' ? 'text-warn-500' : 'text-white',
        )}
      >
        {value}
      </p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  )
}
