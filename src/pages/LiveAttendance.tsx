import { useCallback, useEffect, useState } from 'react'
import { addDays, format, isToday } from 'date-fns'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  Users,
} from 'lucide-react'
import { attendanceForDate, timeOnly, type AttendanceRow } from '@/lib/attendance'
import { StatusPill } from '@/components/attendance/StatusPill'
import { useReferenceData } from '@/lib/reference-data'
import { cn, initials } from '@/lib/utils'

const REFRESH_MS = 15000

export function LiveAttendance() {
  const { departments } = useReferenceData()
  const [date, setDate] = useState(new Date())
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        setRows(await attendanceForDate(date))
        setLastUpdated(new Date())
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [date],
  )

  useEffect(() => {
    void load()
  }, [load])

  // Poll only while viewing today — history does not change.
  useEffect(() => {
    if (!isToday(date)) return
    const timer = setInterval(() => void load(true), REFRESH_MS)
    return () => clearInterval(timer)
  }, [date, load])

  const departmentName = new Map(departments.map((d) => [d.id, d.name]))

  const onDuty = rows.filter((r) => r.check_in_at && !r.check_out_at).length
  const completed = rows.filter((r) => r.check_out_at).length
  const flagged = rows.filter((r) => r.requires_approval).length

  return (
    <div className="px-8 py-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Live Attendance</h1>
          <p className="mt-1 text-sm text-muted">
            {isToday(date) ? 'Today' : format(date, 'EEEE d MMMM yyyy')}
            {lastUpdated && isToday(date) && (
              <> · updated {format(lastUpdated, 'HH:mm:ss')}</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDate((prev) => addDays(prev, -1))}
            className="rounded-control border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Previous day"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setDate(new Date())}
            className="rounded-control border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setDate((prev) => addDays(prev, 1))}
            disabled={isToday(date)}
            className="rounded-control border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Next day"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void load(true)}
            className="ml-1 flex items-center gap-2 rounded-control border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw
              className={cn('size-4', refreshing && 'animate-spin')}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <Tile label="On duty now" value={onDuty} icon={LogIn} tone="brand" />
        <Tile label="Checked out" value={completed} icon={LogOut} tone="neutral" />
        <Tile label="Records today" value={rows.length} icon={Users} tone="neutral" />
        <Tile label="Needs approval" value={flagged} icon={AlertCircle} tone="warn" />
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-control border border-danger-500/20 bg-danger-50 px-4 py-3 text-sm text-danger-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-card border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <Th>Staff</Th>
              <Th>Department</Th>
              <Th>Check in</Th>
              <Th>Check out</Th>
              <Th>Method</Th>
              <Th>Score</Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <span className="inline-flex items-center gap-2 text-sm text-muted">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Loading…
                  </span>
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <Users className="mx-auto mb-2 size-6 text-slate-300" aria-hidden="true" />
                  <p className="text-sm font-medium text-slate-700">No attendance recorded</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {isToday(date)
                      ? 'Records appear here as staff check in at the kiosk.'
                      : 'Nothing was recorded on this date.'}
                  </p>
                </td>
              </tr>
            )}

            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-slate-100 last:border-0',
                  row.requires_approval && 'bg-warn-50/40',
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-800">
                      {initials(row.staff?.full_name ?? '?')}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {row.staff?.full_name ?? 'Unknown'}
                      </p>
                      <p className="id-text text-xs text-muted">{row.staff?.staff_no}</p>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3 text-slate-700">
                  {departmentName.get(row.department_id) ?? '—'}
                </td>

                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className="id-text text-slate-900">{timeOnly(row.check_in_at)}</span>
                    <StatusPill status={row.check_in_status} />
                  </div>
                </td>

                <td className="px-4 py-3">
                  {row.check_out_at ? (
                    <div className="flex flex-col gap-1">
                      <span className="id-text text-slate-900">
                        {timeOnly(row.check_out_at)}
                      </span>
                      <StatusPill status={row.check_out_status} />
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                      On duty
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 capitalize text-slate-700">
                  {row.check_in_method ?? '—'}
                </td>

                <td className="id-text px-4 py-3 text-slate-700">
                  {row.check_in_confidence ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted">
        Match scores are recorded on every row. They are the raw data for tuning the
        acceptance threshold, and for the accuracy figures in your evaluation.
      </p>
    </div>
  )
}

function Tile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: typeof Users
  tone: 'brand' | 'warn' | 'neutral'
}) {
  const styles = {
    brand: 'text-brand-700 bg-brand-50',
    warn: 'text-warn-700 bg-warn-50',
    neutral: 'text-slate-600 bg-slate-100',
  }[tone]

  return (
    <div className="flex items-center gap-3 rounded-card border border-slate-200 bg-white px-4 py-3">
      <span className={cn('flex size-9 items-center justify-center rounded-lg', styles)}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="id-text text-xl font-semibold text-slate-900">{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
      {children}
    </th>
  )
}
