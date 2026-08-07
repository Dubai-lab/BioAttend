import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, format, startOfMonth } from 'date-fns'
import {
  AlertCircle,
  BarChart3,
  Download,
  FlaskConical,
  Loader2,
  Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useReferenceData } from '@/lib/reference-data'
import { downloadCsv, toCsv } from '@/lib/csv'
import { statusLabel, timeOnly, type AttendanceRow } from '@/lib/attendance'
import { cn } from '@/lib/utils'
import type { Staff } from '@/types/database'

interface Attempt {
  id: string
  staff_id: string | null
  method: string
  confidence: number | null
  decision: string
  reason: string | null
  occurred_at: string
}

export function Reports() {
  const { departments } = useReferenceData()

  const [from, setFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [to, setTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [records, setRecords] = useState<AttendanceRow[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [attendanceResult, attemptResult, staffResult] = await Promise.all([
      supabase
        .from('attendance')
        .select('*')
        .gte('shift_date', from)
        .lte('shift_date', to)
        .order('shift_date', { ascending: false }),
      supabase
        .from('attendance_attempts')
        .select('*')
        .gte('occurred_at', `${from}T00:00:00`)
        .lte('occurred_at', `${to}T23:59:59`)
        .order('occurred_at', { ascending: false }),
      supabase.from('staff').select('*'),
    ])

    const failure = attendanceResult.error ?? attemptResult.error ?? staffResult.error
    if (failure) {
      setError(failure.message)
    } else {
      const people = staffResult.data ?? []
      const byId = new Map(people.map((p) => [p.id, p]))
      setStaff(people)
      setRecords(
        (attendanceResult.data ?? []).map((row) => ({ ...row, staff: byId.get(row.staff_id) })),
      )
      setAttempts((attemptResult.data ?? []) as unknown as Attempt[])
    }

    setLoading(false)
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  const staffById = useMemo(() => new Map(staff.map((p) => [p.id, p])), [staff])
  const departmentName = useMemo(
    () => new Map(departments.map((d) => [d.id, d.name])),
    [departments],
  )

  // --- evaluation statistics -----------------------------------------------
  // These are the numbers the accuracy chapter is built from.
  const stats = useMemo(() => {
    const byMethod = { fingerprint: 0, face: 0, manual: 0 }
    for (const row of records) {
      if (row.check_in_method) byMethod[row.check_in_method] += 1
    }

    const identified = attempts.filter(
      (a) => a.decision === 'check_in' || a.decision === 'check_out',
    )
    const rejected = attempts.filter((a) => a.decision === 'rejected')

    const scored = identified.filter((a) => a.confidence !== null)
    const meanConfidence = scored.length
      ? scored.reduce((sum, a) => sum + (a.confidence ?? 0), 0) / scored.length
      : 0

    const fingerprintScores = scored
      .filter((a) => a.method === 'fingerprint')
      .map((a) => a.confidence!)
    const faceScores = scored.filter((a) => a.method === 'face').map((a) => a.confidence!)

    return {
      byMethod,
      totalAttempts: attempts.length,
      accepted: identified.length,
      rejected: rejected.length,
      // Not a true FRR — it counts every rejected scan, including deliberate
      // out-of-window ones. Described honestly rather than overstated.
      rejectionRate: attempts.length ? (rejected.length / attempts.length) * 100 : 0,
      meanConfidence,
      fingerprintRange: range(fingerprintScores),
      faceRange: range(faceScores),
      late: records.filter(
        (r) => r.check_in_status === 'late' || r.check_in_status === 'late_unapproved',
      ).length,
      unscheduled: records.filter((r) => r.check_in_status === 'unscheduled').length,
    }
  }, [records, attempts])

  function exportAttendance() {
    const csv = toCsv(
      [
        'shift_date',
        'staff_no',
        'full_name',
        'department',
        'check_in_at',
        'check_in_method',
        'check_in_confidence',
        'check_in_status',
        'check_out_at',
        'check_out_method',
        'check_out_confidence',
        'check_out_status',
        'requires_approval',
        'approval_note',
      ],
      records.map((row) => [
        row.shift_date,
        row.staff?.staff_no ?? '',
        row.staff?.full_name ?? '',
        departmentName.get(row.department_id) ?? '',
        row.check_in_at ?? '',
        row.check_in_method ?? '',
        row.check_in_confidence ?? '',
        row.check_in_status ?? '',
        row.check_out_at ?? '',
        row.check_out_method ?? '',
        row.check_out_confidence ?? '',
        row.check_out_status ?? '',
        row.requires_approval,
        row.approval_note ?? '',
      ]),
    )
    downloadCsv(`bioattend-attendance-${from}-to-${to}.csv`, csv)
  }

  function exportAttempts() {
    const csv = toCsv(
      ['occurred_at', 'staff_no', 'full_name', 'method', 'confidence', 'decision', 'reason'],
      attempts.map((attempt) => {
        const person = attempt.staff_id ? staffById.get(attempt.staff_id) : undefined
        return [
          attempt.occurred_at,
          person?.staff_no ?? '',
          person?.full_name ?? '',
          attempt.method,
          attempt.confidence ?? '',
          attempt.decision,
          attempt.reason ?? '',
        ]
      }),
    )
    downloadCsv(`bioattend-scan-attempts-${from}-to-${to}.csv`, csv)
  }

  return (
    <div className="px-8 py-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
          <p className="mt-1 text-sm text-muted">Attendance analytics and exports</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <DateField label="From" value={from} onChange={setFrom} />
          <DateField label="To" value={to} onChange={setTo} />
          <button
            type="button"
            onClick={() => setFrom(format(addDays(new Date(), -30), 'yyyy-MM-dd'))}
            className="rounded-control border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Last 30 days
          </button>
        </div>
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

      {loading ? (
        <div className="flex items-center gap-2 rounded-card border border-slate-200 bg-white px-4 py-12 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading…
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            <Tile label="Attendance records" value={records.length} icon={Users} />
            <Tile label="Scan attempts" value={stats.totalAttempts} icon={BarChart3} />
            <Tile label="Late arrivals" value={stats.late} icon={AlertCircle} tone="warn" />
            <Tile
              label="Unscheduled"
              value={stats.unscheduled}
              icon={AlertCircle}
              tone="warn"
            />
          </div>

          {/* Evaluation data */}
          <section className="mb-5 rounded-card border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-2 font-medium text-slate-900">
              <FlaskConical className="size-4 text-slate-400" aria-hidden="true" />
              Biometric performance
            </h2>
            <p className="mt-1 text-sm text-muted">
              Raw figures for the evaluation. Export the scan attempts to compute
              distributions and pick thresholds from evidence.
            </p>

            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="By fingerprint" value={`${stats.byMethod.fingerprint}`} />
              <Stat label="By face" value={`${stats.byMethod.face}`} />
              <Stat label="Manual" value={`${stats.byMethod.manual}`} />
              <Stat label="Accepted scans" value={`${stats.accepted}`} />
              <Stat label="Rejected scans" value={`${stats.rejected}`} />
              <Stat
                label="Rejection rate"
                value={`${stats.rejectionRate.toFixed(1)}%`}
              />
              <Stat
                label="Fingerprint score range"
                value={stats.fingerprintRange}
              />
              <Stat label="Face score range" value={stats.faceRange} />
              <Stat
                label="Mean confidence"
                value={stats.meanConfidence ? stats.meanConfidence.toFixed(1) : '—'}
              />
            </dl>

            <p className="mt-4 rounded-control bg-slate-50 px-3 py-2 text-xs text-muted">
              The rejection rate counts every refused scan, including deliberate
              out-of-window attempts — it is not a false rejection rate. A true FRR
              needs each attempt labelled with who was actually present, which the
              exported attempts file lets you do by hand.
            </p>
          </section>

          {/* Exports */}
          <section className="mb-5 rounded-card border border-slate-200 bg-white p-5">
            <h2 className="font-medium text-slate-900">Export</h2>
            <p className="mt-1 text-sm text-muted">
              CSV, UTF-8, opens directly in Excel.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={exportAttendance}
                disabled={records.length === 0}
                className="flex items-center gap-2 rounded-control bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <Download className="size-4" aria-hidden="true" />
                Attendance ({records.length})
              </button>

              <button
                type="button"
                onClick={exportAttempts}
                disabled={attempts.length === 0}
                className="flex items-center gap-2 rounded-control border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="size-4" aria-hidden="true" />
                Scan attempts ({attempts.length})
              </button>
            </div>

            <p className="mt-3 text-xs text-muted">
              The attempts file includes rejections and every confidence score — that
              is the one the accuracy chapter is built from.
            </p>
          </section>

          {/* Preview */}
          <div className="overflow-x-auto rounded-card border border-slate-200 bg-white">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <Th>Date</Th>
                  <Th>Staff</Th>
                  <Th>In</Th>
                  <Th>Out</Th>
                  <Th>Method</Th>
                  <Th>Score</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                      No attendance in this range.
                    </td>
                  </tr>
                )}
                {records.slice(0, 50).map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    <td className="id-text px-4 py-2.5 text-slate-700">{row.shift_date}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-900">{row.staff?.full_name}</p>
                      <p className="id-text text-xs text-muted">{row.staff?.staff_no}</p>
                    </td>
                    <td className="id-text px-4 py-2.5 text-slate-700">
                      {timeOnly(row.check_in_at)}
                    </td>
                    <td className="id-text px-4 py-2.5 text-slate-700">
                      {timeOnly(row.check_out_at)}
                    </td>
                    <td className="px-4 py-2.5 capitalize text-slate-700">
                      {row.check_in_method ?? '—'}
                    </td>
                    <td className="id-text px-4 py-2.5 text-slate-700">
                      {row.check_in_confidence ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {statusLabel(row.check_in_status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {records.length > 50 && (
              <p className="border-t border-slate-200 px-4 py-2 text-xs text-muted">
                Showing 50 of {records.length}. Export for the full set.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function range(values: number[]): string {
  if (values.length === 0) return '—'
  return `${Math.min(...values)} – ${Math.max(...values)}`
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="id-text rounded-control border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
      />
    </label>
  )
}

function Tile({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string
  value: number
  icon: typeof Users
  tone?: 'neutral' | 'warn'
}) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-slate-200 bg-white px-4 py-3">
      <span
        className={cn(
          'flex size-9 items-center justify-center rounded-lg',
          tone === 'warn' ? 'bg-warn-50 text-warn-700' : 'bg-slate-100 text-slate-600',
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="id-text text-xl font-semibold text-slate-900">{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="id-text mt-0.5 text-sm text-slate-900">{value}</dd>
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
