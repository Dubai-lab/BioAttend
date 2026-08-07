/**
 * Database types.
 *
 * Hand-written for now to keep the foundation moving. Once the migrations are
 * applied you can regenerate the authoritative version with:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type ConsoleRole = 'admin' | 'supervisor'
export type StaffStatus = 'active' | 'suspended' | 'terminated'
export type ShiftCode = 'morning' | 'evening' | 'night'
export type FingerPosition = 'left_thumb' | 'left_index' | 'right_thumb' | 'right_index'
export type BiometricMethod = 'fingerprint' | 'face' | 'manual'
export type CheckInStatus = 'on_time' | 'late' | 'late_unapproved' | 'unscheduled'
export type CheckOutStatus = 'on_time' | 'early' | 'late' | 'missing'
export type JobCategory = 'medical' | 'nursing' | 'allied_health' | 'support' | 'admin'

export type Profile = {
  id: string
  full_name: string
  email: string
  role: ConsoleRole
  department_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Department = {
  id: string
  code: string
  name: string
  is_clinical: boolean
  created_at: string
}

export type JobTitle = {
  id: string
  title: string
  category: JobCategory
  created_at: string
}

export type Staff = {
  id: string
  staff_no: string
  full_name: string
  department_id: string
  job_title_id: string
  phone: string | null
  email: string | null
  status: StaffStatus
  starts_on: string
  ends_on: string | null
  consent_given: boolean
  consent_given_at: string | null
  consent_form_url: string | null
  fingerprints_enrolled: number
  face_enrolled: boolean
  created_at: string
  updated_at: string
}

export type Shift = {
  id: string
  code: ShiftCode
  name: string
  starts_at: string
  ends_at: string
  checkin_opens_before_min: number
  checkin_grace_after_min: number
  checkout_opens_before_min: number
  checkout_closes_after_min: number
  crosses_midnight: boolean
  is_active: boolean
}

export type Attendance = {
  id: string
  staff_id: string
  shift_date: string
  shift_id: string | null
  department_id: string
  check_in_at: string | null
  check_in_method: BiometricMethod | null
  check_in_confidence: number | null
  check_in_status: CheckInStatus | null
  check_out_at: string | null
  check_out_method: BiometricMethod | null
  check_out_confidence: number | null
  check_out_status: CheckOutStatus | null
  requires_approval: boolean
  approved_by: string | null
  approved_at: string | null
  approval_note: string | null
  created_at: string
  updated_at: string
}

/** Verdict returned by the record_attendance() database function. */
export interface AttendanceVerdict {
  decision: 'check_in' | 'check_out' | 'rejected' | 'duplicate'
  status?: CheckInStatus | CheckOutStatus
  reason?: string
  staff_name?: string
  staff_no?: string
  shift?: string
  at?: string
  note?: string
  opens_at?: string
  checkout_opens_at?: string
  checked_in_at?: string
  checked_out_at?: string
}

export type FingerprintTemplate = {
  id: string
  staff_id: string
  finger: FingerPosition
  template: string
  quality: number
  minutiae: number | null
  enrolled_by: string | null
  device_id: string | null
  created_at: string
}

/** Result of the verify_face() 1:1 check. */
export type FaceVerifyResult = {
  ok: boolean
  reason?: 'invalid_kiosk' | 'no_face_enrolled'
  similarity?: number
  threshold?: number
}

/** Result of the identify_face() 1:N fallback. */
export type FaceIdentifyResult = {
  matched: boolean
  staff_id?: string
  similarity?: number
  margin?: number
  reason?: 'invalid_kiosk' | 'no_candidates' | 'below_threshold' | 'ambiguous'
}

export type AttendanceAttempt = {
  id: string
  staff_id: string | null
  kiosk_id: string | null
  method: BiometricMethod
  confidence: number | null
  decision: 'check_in' | 'check_out' | 'rejected' | 'duplicate'
  reason: string | null
  occurred_at: string
}

export type Kiosk = {
  id: string
  code: string
  label: string
  location: string | null
  reader_id: string | null
  has_camera: boolean
  is_active: boolean
  last_seen_at: string | null
  created_at: string
}

export type AuditLogEntry = {
  id: string
  actor_id: string | null
  action: string
  entity: string
  entity_id: string | null
  detail: Record<string, unknown> | null
  occurred_at: string
}

export type HospitalSettings = {
  id: boolean
  hospital_name: string
  system_name: string
  timezone: string
  face_match_threshold: number
  face_match_margin: number
  fingerprint_min_quality: number
  min_shift_duration_min: number
  updated_at: string
}

export type FaceEmbedding = {
  id: string
  staff_id: string
  /**
   * pgvector column. Sent as a bracketed string ("[0.1,0.2,...]") and read
   * back the same way — supabase-js does not convert it to an array.
   */
  embedding: string
  angle: 'front' | 'left' | 'right' | 'up' | 'down'
  quality: number
  enrolled_by: string | null
  created_at: string
}

export type ShiftAssignment = {
  id: string
  staff_id: string
  shift_id: string
  shift_date: string
  notes: string | null
  created_by: string | null
  created_at: string
}

export type Reader = {
  id: string
  label: string
  location: string | null
  firmware: string | null
  resolution_dpi: number | null
  capacity: number
  last_synced_at: string | null
  last_seen_at: string | null
  is_active: boolean
  created_at: string
}

export type ReaderSlot = {
  reader_id: string
  slot_id: number
  template_id: string
  staff_id: string
  synced_at: string
}

/**
 * Shape for createClient<Database>().
 *
 * Every row type above is a `type`, never an `interface`. supabase-js requires
 * rows to satisfy Record<string, unknown>, and TypeScript only grants implicit
 * index signatures to type aliases — an interface silently fails the
 * constraint and the whole schema collapses to `never`, with errors pointing
 * at the call site rather than the cause.
 *
 * Regenerate with the Supabase CLI once the schema settles:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */
type TableShape<Row> = {
  Row: Row
  Insert: Partial<Row>
  Update: Partial<Row>
  Relationships: []
}

// NOTE: this MUST be a `type`, not an `interface`.
// supabase-js requires the schema to satisfy Record<string, GenericTable>, and
// TypeScript only gives implicit index signatures to type aliases — an
// interface silently fails the constraint and every table collapses to `never`.
export type Database = {
  public: {
    Tables: {
      profiles: TableShape<Profile>
      departments: TableShape<Department>
      job_titles: TableShape<JobTitle>
      staff: TableShape<Staff>
      shifts: TableShape<Shift>
      shift_assignments: TableShape<ShiftAssignment>
      attendance: TableShape<Attendance>
      fingerprint_templates: TableShape<FingerprintTemplate>
      face_embeddings: TableShape<FaceEmbedding>
      hospital_settings: TableShape<HospitalSettings>
      attendance_attempts: TableShape<AttendanceAttempt>
      audit_log: TableShape<AuditLogEntry>
      kiosks: TableShape<Kiosk>
      readers: TableShape<Reader>
      reader_slots: TableShape<ReaderSlot>
    }
    Views: { [_ in never]: never }
    Functions: {
      record_attendance: {
        Args: {
          p_kiosk_code: string
          p_kiosk_token: string
          p_staff_id: string
          p_method: BiometricMethod
          p_confidence?: number | null
        }
        Returns: AttendanceVerdict
      }
      verify_face: {
        Args: {
          p_kiosk_code: string
          p_kiosk_token: string
          p_staff_id: string
          /** pgvector literal: "[0.1,0.2,...]" */
          p_embedding: string
        }
        Returns: FaceVerifyResult
      }
      /**
       * NOT used by the kiosk. 1:N identification produced a false accept in
       * testing; execute is revoked from anon. Kept for evaluation work only.
       */
      identify_face: {
        Args: {
          p_kiosk_code: string
          p_kiosk_token: string
          p_embedding: string
          p_department_id?: string | null
        }
        Returns: FaceIdentifyResult
      }
      /** The fallback path: staff number states identity, face confirms it. */
      set_staff_status: {
        Args: { p_staff_id: string; p_status: StaffStatus; p_ends_on?: string | null }
        Returns: { ok: boolean; reason?: string }
      }
      assign_console_role: {
        Args: {
          p_email: string
          p_full_name: string
          p_role: ConsoleRole
          p_department_id?: string | null
        }
        Returns: { ok: boolean; reason?: string; user_id?: string }
      }
      revoke_console_access: {
        Args: { p_profile_id: string }
        Returns: { ok: boolean; reason?: string }
      }
      register_kiosk: {
        Args: {
          p_code: string
          p_label: string
          p_location: string
          p_reader_id: string
          p_token: string
        }
        Returns: { ok: boolean; reason?: string; code?: string }
      }
      verify_face_by_staff_no: {
        Args: {
          p_kiosk_code: string
          p_kiosk_token: string
          p_staff_no: string
          p_embedding: string
        }
        Returns: {
          ok: boolean
          reason?: 'invalid_kiosk' | 'not_verified' | 'no_face_enrolled'
          staff_id?: string
          staff_name?: string
          staff_no?: string
          similarity?: number
        }
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
