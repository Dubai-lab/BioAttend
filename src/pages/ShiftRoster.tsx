import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, format, isSameDay, isToday, startOfWeek } from 'date-fns'
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Moon,
  Sunrise,
  Sunset,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useReferenceData } from '@/lib/reference-data'
import { cn, initials } from '@/lib/utils'
import type { Shift, ShiftAssignment, ShiftCode, Staff } from '@/types/database'

const SHIFT_ICONS: Record<ShiftCode, typeof Sunrise> = {
  morning: Sunrise,
  evening: Sunset,
  night: Moon,
}

const SHIFT_STYLES: Record<ShiftCode, string> = {
  morning: 'bg-brand-50 text-brand-800 border-brand-200',
  evening: 'bg-warn-50 text-warn-700 border-warn-500/20',
  night: 'bg-shell-900 text-white border-shell-900',
}

/** Postgres `date` columns are plain YYYY-MM-DD — never send an ISO timestamp. */
function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function ShiftRoster() {
  const { profile } = useAuth()
  const { shifts, departments, loading: refLoading } = useReferenceData()

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  )
  const [staff, setStaff] = useState<Staff[]>([])
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  )

  const loadWeek = useCallback(async () => {
    setLoading(true)
    setError(null)

    const from = toDateKey(days[0])
    const to = toDateKey(days[6])

    const [staffResult, assignmentResult] = await Promise.all([
      supabase.from('staff').select('*').eq('status', 'active').order('full_name'),
      supabase
        .from('shift_assignments')
        .select('*')
        .gte('shift_date', from)
        .lte('shift_date', to),
    ])

    const failure = staffResult.error ?? assignmentResult.error
    if (failure) setError(failure.message)
    else {
      setStaff(staffResult.data ?? [])
      setAssignments(assignmentResult.data ?? [])
    }
    setLoading(false)
  }, [days])

  useEffect(() => {
    void loadWeek()
  }, [loadWeek])

  const assignmentFor = (staffId: string, date: Date) =>
    assignments.find(
      (item) => item.staff_id === staffId && item.shift_date === toDateKey(date),
    )

  async function setShift(person: Staff, date: Date, shiftId: string | null) {
    const key = `${person.id}:${toDateKey(date)}`
    setSaving(key)
    setError(null)

    const dateKey = toDateKey(date)
    const existing = assignmentFor(person.id, date)

    try {
      if (shiftId === null) {
        if (existing) {
          const { error: deleteError } = await supabase
            .from('shift_assignments')
            .delete()
            .eq('id', existing.id)
          if (deleteError) throw new Error(deleteError.message)
          setAssignments((prev) => prev.filter((item) => item.id !== existing.id))
        }
        return
      }

      // unique(staff_id, shift_date) makes this an upsert on that pair —
      // one shift per person per day, enforced by the database.
      const { data, error: upsertError } = await supabase
        .from('shift_assignments')
        .upsert(
          {
            staff_id: person.id,
            shift_id: shiftId,
            shift_date: dateKey,
            created_by: profile?.id ?? null,
          },
          { onConflict: 'staff_id,shift_date' },
        )
        .select()
        .single()

      if (upsertError) throw new Error(upsertError.message)

      setAssignments((prev) => [
        ...prev.filter((item) => !(item.staff_id === person.id && item.shift_date === dateKey)),
        data,
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(null)
    }
  }

  const departmentName = useMemo(
    () => new Map(departments.map((d) => [d.id, d.name])),
    [departments],
  )

  const weekCount = assignments.length

  return (
    <div className="px-8 py-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Shift Roster</h1>
          <p className="mt-1 text-sm text-muted">
            {loading ? 'Loading…' : `${weekCount} shifts assigned this week`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((prev) => addDays(prev, -7))}
            className="rounded-control border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="rounded-control border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            This week
          </button>

          <button
            type="button"
            onClick={() => setWeekStart((prev) => addDays(prev, 7))}
            className="rounded-control border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Next week"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>

          <span className="ml-2 flex items-center gap-2 text-sm text-slate-700">
            <CalendarDays className="size-4 text-slate-400" aria-hidden="true" />
            {format(days[0], 'd MMM')} – {format(days[6], 'd MMM yyyy')}
          </span>
        </div>
      </header>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
        {shifts.map((shift) => {
          const Icon = SHIFT_ICONS[shift.code]
          return (
            <span
              key={shift.id}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
                SHIFT_STYLES[shift.code],
              )}
            >
              <Icon className="size-3" aria-hidden="true" />
              {shift.name}
              <span className="id-text opacity-70">
                {shift.starts_at.slice(0, 5)}–{shift.ends_at.slice(0, 5)}
              </span>
            </span>
          )
        })}
        <span className="text-muted">
          Night shifts cross midnight and are filed under the day they begin.
        </span>
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

      <div className="overflow-x-auto rounded-card border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="sticky left-0 z-10 bg-white px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                Staff
              </th>
              {days.map((day) => (
                <th
                  key={day.toISOString()}
                  className={cn(
                    'px-2 py-2.5 text-center text-xs font-medium',
                    isToday(day) ? 'text-brand-700' : 'text-slate-500',
                  )}
                >
                  <span className="block uppercase tracking-wide">{format(day, 'EEE')}</span>
                  <span
                    className={cn(
                      'id-text mt-0.5 inline-flex size-6 items-center justify-center rounded-full',
                      isToday(day) && 'bg-brand-600 text-white',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {(loading || refLoading) && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <span className="inline-flex items-center gap-2 text-sm text-muted">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Loading roster…
                  </span>
                </td>
              </tr>
            )}

            {!loading && !refLoading && staff.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <p className="text-sm font-medium text-slate-700">No active staff</p>
                  <p className="mt-0.5 text-sm text-muted">
                    Enrol staff before building a roster.
                  </p>
                </td>
              </tr>
            )}

            {!loading &&
              staff.map((person) => (
                <tr key={person.id} className="border-b border-slate-100 last:border-0">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-medium text-brand-800">
                        {initials(person.full_name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {person.full_name}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {departmentName.get(person.department_id) ?? '—'}
                        </p>
                      </div>
                    </div>
                  </td>

                  {days.map((day) => {
                    const assignment = assignmentFor(person.id, day)
                    const shift = shifts.find((s) => s.id === assignment?.shift_id)
                    const key = `${person.id}:${toDateKey(day)}`
                    const isSaving = saving === key

                    return (
                      <td key={day.toISOString()} className="px-1.5 py-2 text-center">
                        <ShiftCell
                          shift={shift}
                          shifts={shifts}
                          saving={isSaving}
                          highlight={isSameDay(day, new Date())}
                          onChange={(shiftId) => void setShift(person, day, shiftId)}
                          label={`${person.full_name}, ${format(day, 'EEEE d MMMM')}`}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted">
        One shift per person per day — the database enforces it, so assigning a second
        replaces the first. Changes save immediately.
      </p>
    </div>
  )
}

function ShiftCell({
  shift,
  shifts,
  saving,
  highlight,
  onChange,
  label,
}: {
  shift: Shift | undefined
  shifts: Shift[]
  saving: boolean
  highlight: boolean
  onChange: (shiftId: string | null) => void
  label: string
}) {
  const Icon = shift ? SHIFT_ICONS[shift.code] : null

  return (
    <div className="relative">
      <select
        aria-label={label}
        value={shift?.id ?? ''}
        disabled={saving}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
        className={cn(
          'w-full cursor-pointer appearance-none rounded-control border px-2 py-1.5 text-center text-xs font-medium',
          'focus:ring-2 focus:ring-brand-500/30 focus:outline-none',
          shift
            ? SHIFT_STYLES[shift.code]
            : cn(
                'border-dashed border-slate-300 bg-white text-slate-400',
                highlight && 'border-brand-300',
              ),
          saving && 'opacity-50',
        )}
      >
        <option value="">—</option>
        {shifts.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>

      {Icon && !saving && (
        <Icon
          className="pointer-events-none absolute left-1.5 top-1/2 size-3 -translate-y-1/2 opacity-70"
          aria-hidden="true"
        />
      )}
      {saving && (
        <Loader2
          className="pointer-events-none absolute left-1.5 top-1/2 size-3 -translate-y-1/2 animate-spin"
          aria-hidden="true"
        />
      )}
    </div>
  )
}
