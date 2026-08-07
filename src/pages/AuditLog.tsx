import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { AlertCircle, Loader2, ScrollText, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn, initials } from '@/lib/utils'
import type { Profile } from '@/types/database'

interface AuditEntry {
  id: string
  actor_id: string | null
  action: string
  entity: string
  entity_id: string | null
  detail: Record<string, unknown> | null
  occurred_at: string
}

/**
 * Console audit trail.
 *
 * Attendance itself is already tamper-evident — every scan lands in
 * attendance_attempts and approvals record who signed off without altering
 * the captured times. This page covers the other half: what console users
 * changed.
 */
export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [actors, setActors] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [logResult, profileResult] = await Promise.all([
      supabase
        .from('audit_log')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(200),
      supabase.from('profiles').select('*'),
    ])

    if (logResult.error) setError(logResult.error.message)
    else setEntries((logResult.data ?? []) as unknown as AuditEntry[])

    setActors(profileResult.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const actorById = useMemo(() => new Map(actors.map((a) => [a.id, a])), [actors])

  return (
    <div className="px-8 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Audit Log</h1>
        <p className="mt-1 text-sm text-muted">Who changed what in the console</p>
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
          Loading…
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="rounded-card border border-slate-200 bg-white px-6 py-16 text-center">
          <ScrollText className="mx-auto mb-3 size-6 text-slate-300" aria-hidden="true" />
          <p className="font-medium text-slate-900">No console changes recorded</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Attendance keeps its own trail: every scan is written to{' '}
            <span className="id-text">attendance_attempts</span>, including the ones that
            were refused, and approvals record who signed off without altering the
            captured times.
          </p>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
                <Th>Detail</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const actor = entry.actor_id ? actorById.get(entry.actor_id) : undefined
                return (
                  <tr key={entry.id} className="border-b border-slate-100 last:border-0">
                    <td className="id-text px-4 py-2.5 whitespace-nowrap text-slate-700">
                      {format(new Date(entry.occurred_at), 'd MMM HH:mm:ss')}
                    </td>
                    <td className="px-4 py-2.5">
                      {actor ? (
                        <span className="flex items-center gap-2">
                          <span className="flex size-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-medium text-brand-800">
                            {initials(actor.full_name)}
                          </span>
                          <span className="text-slate-900">{actor.full_name}</span>
                        </span>
                      ) : (
                        <span className="text-muted">System</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {entry.entity}
                      {entry.entity_id && (
                        <span className="id-text ml-1 text-xs text-muted">
                          {entry.entity_id.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="id-text max-w-xs truncate px-4 py-2.5 text-xs text-muted">
                      {entry.detail ? JSON.stringify(entry.detail) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-5 rounded-card border border-slate-200 bg-white p-5">
        <h2 className="flex items-center gap-2 font-medium text-slate-900">
          <ShieldCheck className="size-4 text-brand-600" aria-hidden="true" />
          What is already tamper-evident
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <Point>
            Every scan is recorded in <span className="id-text">attendance_attempts</span>,
            including rejections — a refused check-in leaves evidence rather than nothing.
          </Point>
          <Point>
            Attendance can only be written by <span className="id-text">record_attendance()</span>,
            which verifies a kiosk credential. No browser role holds INSERT on the table.
          </Point>
          <Point>
            Approving an exception never rewrites the scan time. It records who
            approved it and when, alongside the original capture.
          </Point>
          <Point>
            Staff have no accounts, so nobody can mark themselves present from
            anywhere but a registered kiosk.
          </Point>
        </ul>
      </section>
    </div>
  )
}

function Point({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className={cn('px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500')}>
      {children}
    </th>
  )
}
