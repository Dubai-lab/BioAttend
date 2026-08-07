import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import type { Attendance, Staff } from '@/types/database'

/** Attendance joined to the person it belongs to. */
export interface AttendanceRow extends Attendance {
  staff?: Staff
}

/**
 * Attendance for one shift date, with staff attached.
 *
 * Staff are fetched separately and merged rather than using a PostgREST
 * embed. The hand-written `Relationships: []` in our Database type means
 * embedded selects lose their typing, and a second small query is cheaper
 * than the confusion.
 */
export async function attendanceForDate(date: Date): Promise<AttendanceRow[]> {
  const shiftDate = format(date, 'yyyy-MM-dd')

  const { data: records, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('shift_date', shiftDate)
    .order('check_in_at', { ascending: false })

  if (error) throw new Error(error.message)
  if (!records || records.length === 0) return []

  return attachStaff(records)
}

/** Everything still awaiting a supervisor decision, newest first. */
export async function pendingExceptions(): Promise<AttendanceRow[]> {
  const { data: records, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('requires_approval', true)
    .order('shift_date', { ascending: false })

  if (error) throw new Error(error.message)
  if (!records || records.length === 0) return []

  return attachStaff(records)
}

async function attachStaff(records: Attendance[]): Promise<AttendanceRow[]> {
  const ids = [...new Set(records.map((row) => row.staff_id))]

  const { data: people } = await supabase.from('staff').select('*').in('id', ids)
  const byId = new Map((people ?? []).map((person) => [person.id, person]))

  return records.map((row) => ({ ...row, staff: byId.get(row.staff_id) }))
}

/**
 * Sign off on a flagged record.
 *
 * Approval never rewrites times. It records that a human looked at an
 * anomaly and accepted it — the original scan stays exactly as captured,
 * which is what makes the log defensible.
 */
export async function approveAttendance(
  id: string,
  approverId: string,
  note: string,
): Promise<void> {
  const { error } = await supabase
    .from('attendance')
    .update({
      requires_approval: false,
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      approval_note: note.trim() || null,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export function statusLabel(status: string | null): string {
  switch (status) {
    case 'on_time':
      return 'On time'
    case 'late':
      return 'Late'
    case 'late_unapproved':
      return 'Late — unapproved'
    case 'unscheduled':
      return 'Unscheduled'
    case 'early':
      return 'Early departure'
    case 'missing':
      return 'No check-out'
    default:
      return '—'
  }
}

export function statusTone(status: string | null): 'good' | 'warn' | 'bad' | 'neutral' {
  switch (status) {
    case 'on_time':
      return 'good'
    case 'late':
    case 'early':
      return 'warn'
    case 'late_unapproved':
    case 'unscheduled':
    case 'missing':
      return 'bad'
    default:
      return 'neutral'
  }
}

export function timeOnly(iso: string | null): string {
  return iso ? format(new Date(iso), 'HH:mm') : '—'
}
