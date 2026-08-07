import { supabase } from '@/lib/supabase'

/**
 * Console audit trail.
 *
 * Records what console users changed. Attendance keeps its own trail — every
 * scan lands in attendance_attempts and approvals never rewrite captured
 * times — so this covers the other half: enrolment, biometric capture,
 * settings, syncs and staff status changes.
 *
 * Deliberately never throws. An audit write failing must not roll back or
 * block the action the user was performing; a missing log line is a smaller
 * problem than a half-completed enrolment.
 */

export type AuditAction =
  | 'staff.enrolled'
  | 'staff.updated'
  | 'staff.deactivated'
  | 'staff.reactivated'
  | 'fingerprint.captured'
  | 'fingerprint.deleted'
  | 'face.captured'
  | 'face.deleted'
  | 'attendance.approved'
  | 'settings.updated'
  | 'reader.synced'
  | 'reader.registered'
  | 'kiosk.registered'
  | 'kiosk.token_rotated'
  | 'supervisor.assigned'
  | 'supervisor.removed'

export async function recordAudit(
  actorId: string | null | undefined,
  action: AuditAction,
  entity: string,
  entityId?: string | null,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      actor_id: actorId ?? null,
      action,
      entity,
      entity_id: entityId ?? null,
      // Biometric payloads must never reach the log — see redact().
      detail: detail ? redact(detail) : null,
    })
  } catch (err) {
    console.warn('[audit] could not record entry:', err)
  }
}

/**
 * Strip anything that should not be written to a log.
 *
 * Templates and embeddings are the crown jewels of this system; an audit
 * trail that quietly copies them into a second, less-protected table would
 * undo the point of restricting the biometric tables in the first place.
 */
function redact(detail: Record<string, unknown>): Record<string, unknown> {
  const banned = ['template', 'embedding', 'token', 'password', 'token_hash']
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(detail)) {
    if (banned.some((word) => key.toLowerCase().includes(word))) {
      out[key] = '[redacted]'
      continue
    }
    // Long strings are almost always encoded biometric data.
    out[key] = typeof value === 'string' && value.length > 200 ? '[truncated]' : value
  }

  return out
}
