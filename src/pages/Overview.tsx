import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Fingerprint,
  LogIn,
  ScanFace,
  UserPlus,
  Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useReferenceData } from '@/lib/reference-data'
import { attendanceForDate, timeOnly, type AttendanceRow } from '@/lib/attendance'
import { StatusPill } from '@/components/attendance/StatusPill'
import { bridge } from '@/lib/fingerprint/bridge'
import { cn, initials } from '@/lib/utils'
import type { Staff } from '@/types/database'

const REFRESH_MS = 20000

/**
 * Landing page.
 *
 * Role-aware rather than two separate pages: an admin sees the hospital, a
 * supervisor sees their department. The data scoping is done by RLS, so the
 * same queries return different rows depending on who is signed in — the page
 * only changes its wording and which shortcuts it offers.
 */
export function Overview() {
  const { profile, isAdmin } = useAuth()
  const { departments } = useReferenceData()

  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [rosteredToday, setRosteredToday] = useState(0)
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const today = format(new Date(), 'yyyy-MM-dd')

    const [attendance, staffResult, roster, approvals] = await Promise.all([
      attendanceForDate(new Date()).catch(() => []),
      supabase.from('staff').select('*').eq('status', 'active'),
      supabase.from('shift_assignments').select('id').eq('shift_date', today),
      supabase.from('attendance').select('id').eq('requires_approval', true),
    ])

    setRows(attendance)
    setStaff(staffResult.data ?? [])
    setRosteredToday(roster.data?.length ?? 0)
    setPendingApprovals(approvals.data?.length ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    void bridge.isOnline().then(setBridgeOnline)
  }, [])

  const departmentName = useMemo(
    () => new Map(departments.map((d) => [d.id, d.name])),
    [departments],
  )

  const onDuty = rows.filter((r) => r.check_in_at && !r.check_out_at)
  const completed = rows.filter((r) => r.check_out_at)
  const flagged = rows.filter((r) => r.requires_approval)

  // Enrolment gaps are the quiet failure: someone with one finger and no face
  // works fine until the day that hand is bandaged.
  const noBiometrics = staff.filter((p) => p.fingerprints_enrolled === 0 && !p.face_enrolled)
  const weaklyEnrolled = staff.filter(
    (p) => p.fingerprints_enrolled > 0 && p.fingerprints_enrolled < 2 && !p.face_enrolled,
  )

  const scope = isAdmin ? 'Hospital-wide' : (departmentName.get(profile?.department_id ?? '') ?? 'Your department')

  return (
    <div className="px-8 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">
          Good {partOfDay()}, {profile?.full_name?.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {scope} · {format(new Date(), 'EEEE d MMMM yyyy')}
        </p>
      </header>

      {/* Today */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="On duty now"
          value={onDuty.length}
          icon={LogIn}
          tone="brand"
          to="/live"
        />
        <Tile
          label="Checked out"
          value={completed.length}
          icon={CheckCircle2}
          tone="neutral"
          to="/live"
        />
        <Tile
          label="Rostered today"
          value={rosteredToday}
          icon={CalendarDays}
          tone="neutral"
          to="/roster"
        />
        <Tile
          label="Awaiting approval"
          value={pendingApprovals}
          icon={AlertTriangle}
          tone={pendingApprovals > 0 ? 'warn' : 'neutral'}
          to="/exceptions"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Recent activity */}
        <section className="rounded-card border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="font-medium text-slate-900">Today&apos;s activity</h2>
            <Link
              to="/live"
              className="flex items-center gap-1 text-sm text-brand-700 hover:underline"
            >
              Live attendance
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>

          {loading && (
            <p className="px-5 py-10 text-center text-sm text-muted">Loading…</p>
          )}

          {!loading && rows.length === 0 && (
            <div className="px-5 py-12 text-center">
              <Clock className="mx-auto mb-2 size-6 text-slate-300" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-700">Nobody has checked in yet</p>
              <p className="mt-0.5 text-sm text-muted">
                Records appear here as staff use the kiosk.
              </p>
            </div>
          )}

          <ul className="divide-y divide-slate-100">
            {rows.slice(0, 8).map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-800">
                  {initials(row.staff?.full_name ?? '?')}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {row.staff?.full_name ?? 'Unknown'}
                  </p>
                  <p className="text-xs text-muted">
                    {departmentName.get(row.department_id) ?? '—'}
                  </p>
                </div>

                <span className="hidden items-center gap-1 text-xs text-muted sm:flex">
                  {row.check_in_method === 'face' ? (
                    <ScanFace className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Fingerprint className="size-3.5" aria-hidden="true" />
                  )}
                  {row.check_in_method}
                </span>

                <span className="id-text text-sm text-slate-700">
                  {timeOnly(row.check_in_at)}
                </span>

                <StatusPill status={row.check_in_status} />
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-4">
          {/* Enrolment health — admin only, since only they can fix it */}
          {isAdmin && (
            <section className="rounded-card border border-slate-200 bg-white p-5">
              <h2 className="mb-3 flex items-center gap-2 font-medium text-slate-900">
                <Users className="size-4 text-slate-400" aria-hidden="true" />
                Enrolment
              </h2>

              <dl className="space-y-2 text-sm">
                <Row label="Active staff" value={`${staff.length}`} />
                <Row
                  label="No biometrics"
                  value={`${noBiometrics.length}`}
                  tone={noBiometrics.length > 0 ? 'warn' : undefined}
                />
                <Row
                  label="Only one finger"
                  value={`${weaklyEnrolled.length}`}
                  tone={weaklyEnrolled.length > 0 ? 'warn' : undefined}
                />
                <Row
                  label="Face enrolled"
                  value={`${staff.filter((p) => p.face_enrolled).length}`}
                />
              </dl>

              {(noBiometrics.length > 0 || weaklyEnrolled.length > 0) && (
                <p className="mt-3 rounded-control bg-warn-50 px-3 py-2 text-xs text-warn-700">
                  Staff with one finger and no face have no way to clock in the day that
                  hand is bandaged.
                </p>
              )}

              <Link
                to="/enrollment"
                className="mt-4 flex items-center justify-center gap-2 rounded-control bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                <UserPlus className="size-4" aria-hidden="true" />
                Enrol staff
              </Link>
            </section>
          )}

          {/* Device status */}
          <section className="rounded-card border border-slate-200 bg-white p-5">
            <h2 className="mb-3 font-medium text-slate-900">Reader</h2>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'size-2 rounded-full',
                  bridgeOnline ? 'bg-success-500' : 'bg-danger-500',
                )}
                aria-hidden="true"
              />
              <p className="text-sm text-slate-700">
                Fingerprint service{' '}
                {bridgeOnline === null ? 'checking…' : bridgeOnline ? 'online' : 'offline'}
              </p>
            </div>
            {bridgeOnline === false && (
              <p className="mt-2 text-xs text-muted">
                Start <span className="id-text">bridge/run-bridge.bat</span> on the
                station with the reader attached.
              </p>
            )}
          </section>

          {flagged.length > 0 && (
            <section className="rounded-card border border-warn-500/30 bg-warn-50 p-5">
              <h2 className="flex items-center gap-2 font-medium text-warn-700">
                <AlertTriangle className="size-4" aria-hidden="true" />
                {flagged.length} to review today
              </h2>
              <p className="mt-1 text-sm text-warn-700/90">
                Late, unscheduled or early departures awaiting sign-off.
              </p>
              <Link
                to="/exceptions"
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-warn-700 hover:underline"
              >
                Review them
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function partOfDay(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function Tile({
  label,
  value,
  icon: Icon,
  tone,
  to,
}: {
  label: string
  value: number
  icon: typeof Users
  tone: 'brand' | 'warn' | 'neutral'
  to: string
}) {
  const styles = {
    brand: 'text-brand-700 bg-brand-50',
    warn: 'text-warn-700 bg-warn-50',
    neutral: 'text-slate-600 bg-slate-100',
  }[tone]

  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-card border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300"
    >
      <span className={cn('flex size-9 items-center justify-center rounded-lg', styles)}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="id-text text-xl font-semibold text-slate-900">{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </Link>
  )
}

function Row({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'warn'
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={cn('id-text', tone === 'warn' ? 'text-warn-700' : 'text-slate-900')}>
        {value}
      </dd>
    </div>
  )
}
