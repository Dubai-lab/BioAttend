import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import {
  approveAttendance,
  pendingExceptions,
  statusLabel,
  timeOnly,
  type AttendanceRow,
} from '@/lib/attendance'
import { StatusPill } from '@/components/attendance/StatusPill'
import { useAuth } from '@/lib/auth-context'
import { recordAudit } from '@/lib/audit'
import { useReferenceData } from '@/lib/reference-data'
import { cn, initials } from '@/lib/utils'

export function Exceptions() {
  const { profile } = useAuth()
  const { departments } = useReferenceData()

  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [approving, setApproving] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await pendingExceptions())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function approve(row: AttendanceRow) {
    if (!profile) return
    setApproving(row.id)
    setError(null)
    try {
      await approveAttendance(row.id, profile.id, notes[row.id] ?? '')

      await recordAudit(profile.id, 'attendance.approved', 'attendance', row.id, {
        staff_no: row.staff?.staff_no,
        shift_date: row.shift_date,
        status: row.check_in_status ?? row.check_out_status,
        note: notes[row.id] ?? null,
      })

      setRows((prev) => prev.filter((item) => item.id !== row.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setApproving(null)
    }
  }

  const departmentName = new Map(departments.map((d) => [d.id, d.name]))

  return (
    <div className="px-8 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Exceptions</h1>
        <p className="mt-1 text-sm text-muted">
          Late, unscheduled and early departures awaiting sign-off
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-control border border-danger-500/20 bg-danger-50 px-4 py-3 text-sm text-danger-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 rounded-card border border-slate-200 bg-white px-4 py-12 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading exceptions…
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="rounded-card border border-slate-200 bg-white px-6 py-16 text-center">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-success-50 text-success-700">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </div>
          <p className="font-medium text-slate-900">Nothing to review</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Every attendance record is either clean or already signed off.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row) => {
          const reason = row.check_in_status ?? row.check_out_status
          const busy = approving === row.id

          return (
            <article
              key={row.id}
              className="rounded-card border border-warn-500/30 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-800">
                    {initials(row.staff?.full_name ?? '?')}
                  </span>
                  <div>
                    <p className="font-medium text-slate-900">
                      {row.staff?.full_name ?? 'Unknown staff'}
                    </p>
                    <p className="text-xs text-muted">
                      <span className="id-text">{row.staff?.staff_no}</span>
                      {' · '}
                      {departmentName.get(row.department_id) ?? '—'}
                      {' · '}
                      {format(new Date(row.shift_date), 'EEE d MMM yyyy')}
                    </p>
                  </div>
                </div>

                <StatusPill status={reason} />
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <Detail label="Checked in" value={timeOnly(row.check_in_at)} />
                <Detail
                  label="Checked out"
                  value={row.check_out_at ? timeOnly(row.check_out_at) : 'Still on duty'}
                />
                <Detail
                  label="Match score"
                  value={row.check_in_confidence?.toString() ?? '—'}
                />
              </dl>

              <p className="mt-4 rounded-control bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {explain(reason)}
              </p>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="min-w-56 flex-1">
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">
                    Note (optional, kept on the record)
                  </span>
                  <input
                    value={notes[row.id] ?? ''}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [row.id]: e.target.value }))
                    }
                    placeholder="e.g. Covered emergency theatre list"
                    className="w-full rounded-control border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void approve(row)}
                  disabled={busy}
                  className={cn(
                    'flex items-center gap-2 rounded-control bg-brand-600 px-4 py-2 text-sm font-medium text-white',
                    'hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60',
                  )}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="size-4" aria-hidden="true" />
                  )}
                  Approve
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {rows.length > 0 && (
        <p className="mt-4 text-xs text-muted">
          Approving records that a supervisor reviewed the anomaly and accepted it.
          Scan times are never altered — the original capture stands, which is what
          makes the log defensible.
        </p>
      )}
    </div>
  )
}

function explain(status: string | null): string {
  switch (status) {
    case 'unscheduled':
      return 'This person worked without a shift on the roster. Either the roster was not updated, or they covered for someone.'
    case 'late_unapproved':
      return 'Arrived after the grace window closed. The scan was still recorded rather than discarded, so the time worked is not lost.'
    case 'late':
      return 'Arrived within the grace window but after the shift start.'
    case 'early':
      return 'Checked out before the check-out window opened.'
    case 'missing':
      return 'Checked in but never checked out.'
    default:
      return `Flagged as ${statusLabel(status)}.`
  }
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="id-text mt-0.5 text-sm text-slate-900">{value}</dd>
    </div>
  )
}
