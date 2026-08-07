import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Fingerprint,
  Loader2,
  ScanFace,
  Search,
  UserPlus,
  Users,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useReferenceData } from '@/lib/reference-data'
import { cn, initials } from '@/lib/utils'
import type { Staff } from '@/types/database'

export function StaffDirectory() {
  const { isAdmin } = useAuth()
  const { departments, jobTitles } = useReferenceData()

  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [departmentId, setDepartmentId] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      // No department filter here — RLS already limits a supervisor to their
      // own department. Filtering client-side as well would only hide rows
      // the database already refuses to send.
      const { data, error: loadError } = await supabase
        .from('staff')
        .select('*')
        .order('staff_no')

      if (!active) return

      if (loadError) setError(loadError.message)
      else setStaff(data ?? [])
      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  const departmentName = useMemo(
    () => new Map(departments.map((d) => [d.id, d.name])),
    [departments],
  )
  const titleName = useMemo(
    () => new Map(jobTitles.map((t) => [t.id, t.title])),
    [jobTitles],
  )

  const visible = staff.filter((person) => {
    const matchesQuery =
      query.trim() === '' ||
      person.full_name.toLowerCase().includes(query.toLowerCase()) ||
      person.staff_no.toLowerCase().includes(query.toLowerCase())
    const matchesDept = departmentId === '' || person.department_id === departmentId
    return matchesQuery && matchesDept
  })

  const fullyEnrolled = staff.filter((p) => p.fingerprints_enrolled >= 2).length

  return (
    <div className="px-8 py-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Staff Directory</h1>
          <p className="mt-1 text-sm text-muted">
            {loading
              ? 'Loading…'
              : `${staff.length} staff · ${fullyEnrolled} with usable fingerprint enrolment`}
          </p>
        </div>

        {isAdmin && (
          <Link
            to="/enrollment"
            className="flex items-center gap-2 rounded-control bg-brand-600 px-4 py-2 text-sm
                       font-medium text-white transition-colors hover:bg-brand-700"
          >
            <UserPlus className="size-4" aria-hidden="true" />
            Enrol staff
          </Link>
        )}
      </header>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or staff number"
            aria-label="Search staff"
            className="w-full rounded-control border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm
                       placeholder:text-slate-400 focus:border-brand-500 focus:ring-2
                       focus:ring-brand-500/20 focus:outline-none"
          />
        </div>

        <select
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          aria-label="Filter by department"
          className="rounded-control border border-slate-300 bg-white px-3 py-2 text-sm
                     focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
        >
          <option value="">All departments</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-control border border-danger-500/20
                     bg-danger-50 px-4 py-3 text-sm text-danger-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-card border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <Th>Staff</Th>
              <Th>Department</Th>
              <Th>Role</Th>
              <Th>Biometrics</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <span className="inline-flex items-center gap-2 text-sm text-muted">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Loading staff…
                  </span>
                </td>
              </tr>
            )}

            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Users className="mx-auto mb-2 size-6 text-slate-300" aria-hidden="true" />
                  <p className="text-sm font-medium text-slate-700">
                    {staff.length === 0 ? 'No staff enrolled yet' : 'No matches'}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {staff.length === 0
                      ? 'Enrol your first staff member to get started.'
                      : 'Try a different search or department.'}
                  </p>
                </td>
              </tr>
            )}

            {visible.map((person) => (
              <tr key={person.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link to={`/staff/${person.id}`} className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-800">
                      {initials(person.full_name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 hover:text-brand-700">
                        {person.full_name}
                      </p>
                      <p className="id-text text-xs text-muted">{person.staff_no}</p>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {departmentName.get(person.department_id) ?? '—'}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {titleName.get(person.job_title_id) ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <BiometricBadges
                    fingers={person.fingerprints_enrolled}
                    face={person.face_enrolled}
                  />
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={person.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Enrolment state at a glance.
 *
 * Fewer than two fingers is flagged amber, not green: one finger is a staff
 * member who cannot clock in the day they cut that hand.
 */
function BiometricBadges({ fingers, face }: { fingers: number; face: boolean }) {
  const weak = fingers > 0 && fingers < 2

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
          fingers === 0
            ? 'bg-slate-100 text-slate-500'
            : weak
              ? 'bg-warn-50 text-warn-700'
              : 'bg-success-50 text-success-700',
        )}
        title={weak ? 'Only one finger enrolled — enrol a second' : undefined}
      >
        <Fingerprint className="size-3" aria-hidden="true" />
        {fingers}/4
      </span>

      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
          face ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500',
        )}
      >
        <ScanFace className="size-3" aria-hidden="true" />
        {face ? 'Yes' : 'No'}
      </span>
    </div>
  )
}

function StatusPill({ status }: { status: Staff['status'] }) {
  const styles: Record<Staff['status'], string> = {
    active: 'bg-success-50 text-success-700',
    suspended: 'bg-warn-50 text-warn-700',
    terminated: 'bg-slate-100 text-slate-500',
  }
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs capitalize', styles[status])}>
      {status}
    </span>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
      {children}
    </th>
  )
}
