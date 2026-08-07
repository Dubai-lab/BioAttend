import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Fingerprint,
  Loader2,
  ScanFace,
  ShieldCheck,
  UserMinus,
  UserCheck,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { recordAudit } from '@/lib/audit'
import { useAuth } from '@/lib/auth-context'
import { useReferenceData } from '@/lib/reference-data'
import { FingerCapture, type CapturedFinger } from '@/components/enrollment/FingerCapture'
import { FaceCapture, type CapturedFace } from '@/components/enrollment/FaceCapture'
import { cn, initials } from '@/lib/utils'
import type { FingerPosition, Staff, StaffStatus } from '@/types/database'

const MIN_QUALITY = 40

/**
 * One staff member, with the ability to add or replace their biometrics.
 *
 * Enrolment alone is not enough in practice: people are enrolled before a
 * camera is available, decline and later agree, or have fingers that stop
 * reading after months of hand-washing. Recreating the staff member would
 * destroy their attendance history, so biometrics have to be editable in
 * place.
 */
export function StaffDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile, isAdmin } = useAuth()
  const { departments, jobTitles } = useReferenceData()

  const [staff, setStaff] = useState<Staff | null>(null)
  const [fingers, setFingers] = useState<CapturedFinger[]>([])
  const [faces, setFaces] = useState<CapturedFace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [changingStatus, setChangingStatus] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const [staffResult, fingerResult, faceResult] = await Promise.all([
      supabase.from('staff').select('*').eq('id', id).maybeSingle(),
      supabase.from('fingerprint_templates').select('finger, quality').eq('staff_id', id),
      supabase.from('face_embeddings').select('angle, quality').eq('staff_id', id),
    ])

    if (staffResult.error) setError(staffResult.error.message)
    else setStaff(staffResult.data)

    // Existing captures are shown as already done so the operator can see what
    // is missing. Their stored values are never re-read — only replaced.
    setFingers(
      (fingerResult.data ?? []).map((row) => ({
        position: row.finger as FingerPosition,
        template: '',
        quality: row.quality,
      })),
    )
    setFaces(
      (faceResult.data ?? []).map((row) => ({
        angle: row.angle,
        embedding: [],
        quality: row.quality,
        yaw: 0,
        pitch: 0,
      })),
    )

    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  /** Save one finger immediately — no batching, so nothing is lost on a reload. */
  async function saveFinger(finger: CapturedFinger) {
    if (!staff) return
    setError(null)

    const { error: saveError } = await supabase.from('fingerprint_templates').upsert(
      {
        staff_id: staff.id,
        finger: finger.position,
        template: finger.template,
        quality: finger.quality,
        enrolled_by: profile?.id ?? null,
      },
      { onConflict: 'staff_id,finger' },
    )

    if (saveError) {
      setError(saveError.message)
      return
    }

    await recordAudit(profile?.id, 'fingerprint.captured', 'staff', staff.id, {
      staff_no: staff.staff_no,
      finger: finger.position,
      quality: finger.quality,
    })

    setFingers((prev) => [...prev.filter((f) => f.position !== finger.position), finger])
    setSaved(`${finger.position.replace('_', ' ')} saved`)
    void load()
  }

  async function saveFace(face: CapturedFace) {
    if (!staff) return
    setError(null)

    const { error: saveError } = await supabase.from('face_embeddings').upsert(
      {
        staff_id: staff.id,
        embedding: `[${face.embedding.join(',')}]`,
        angle: face.angle,
        quality: face.quality,
        enrolled_by: profile?.id ?? null,
      },
      { onConflict: 'staff_id,angle' },
    )

    if (saveError) {
      setError(saveError.message)
      return
    }

    await recordAudit(profile?.id, 'face.captured', 'staff', staff.id, {
      staff_no: staff.staff_no,
      angle: face.angle,
      quality: face.quality,
    })

    setFaces((prev) => [...prev.filter((f) => f.angle !== face.angle), face])
    setSaved(`Face angle "${face.angle}" saved`)
    void load()
  }

  /**
   * Deactivate or reinstate.
   *
   * Terminating does not delete anything. The next reader sync writes only
   * active staff, so they drop out of the device's library, and
   * record_attendance already refuses inactive staff — so they are locked out
   * immediately even before a sync. Their attendance history stays: it belongs
   * to the hospital's records, not to their employment.
   */
  async function changeStatus(next: StaffStatus) {
    if (!staff) return
    setChangingStatus(true)
    setError(null)

    const { data, error: statusError } = await supabase.rpc('set_staff_status', {
      p_staff_id: staff.id,
      p_status: next,
    })

    if (statusError) {
      setError(statusError.message)
      setChangingStatus(false)
      return
    }

    const result = data as { ok: boolean; reason?: string }
    if (!result?.ok) {
      setError(result?.reason === 'not_admin' ? 'Administrators only.' : 'Could not change status.')
      setChangingStatus(false)
      return
    }

    await recordAudit(
      profile?.id,
      next === 'active' ? 'staff.reactivated' : 'staff.deactivated',
      'staff',
      staff.id,
      { staff_no: staff.staff_no, status: next },
    )

    setSaved(
      next === 'active'
        ? 'Reinstated — re-sync the reader to restore kiosk access.'
        : 'Deactivated — they can no longer check in. Re-sync the reader to remove them from it.',
    )
    setChangingStatus(false)
    void load()
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-8 py-12 text-sm text-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading staff record…
      </div>
    )
  }

  if (!staff) {
    return (
      <div className="px-8 py-12 text-center">
        <p className="font-medium text-slate-900">Staff member not found</p>
        <Link to="/staff" className="mt-2 inline-block text-sm text-brand-700 hover:underline">
          Back to the directory
        </Link>
      </div>
    )
  }

  const department = departments.find((d) => d.id === staff.department_id)
  const jobTitle = jobTitles.find((t) => t.id === staff.job_title_id)
  const consentMissing = !staff.consent_given

  return (
    <div className="px-8 py-6">
      <Link
        to="/staff"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Staff Directory
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-base font-medium text-brand-800">
            {initials(staff.full_name)}
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{staff.full_name}</h1>
            <p className="text-sm text-muted">
              <span className="id-text">{staff.staff_no}</span> · {jobTitle?.title ?? '—'} ·{' '}
              {department?.name ?? '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span
            className={cn(
              'rounded-full px-2.5 py-1 capitalize',
              staff.status === 'active'
                ? 'bg-success-50 text-success-700'
                : 'bg-slate-100 text-slate-600',
            )}
          >
            {staff.status}
          </span>

          {isAdmin && (
            <button
              type="button"
              onClick={() =>
                void changeStatus(staff.status === 'active' ? 'terminated' : 'active')
              }
              disabled={changingStatus}
              className={cn(
                'flex items-center gap-1.5 rounded-control border px-3 py-1.5 text-sm font-medium transition-colors',
                staff.status === 'active'
                  ? 'border-danger-500/30 text-danger-700 hover:bg-danger-50'
                  : 'border-brand-500/30 text-brand-700 hover:bg-brand-50',
                changingStatus && 'opacity-60',
              )}
            >
              {staff.status === 'active' ? (
                <>
                  <UserMinus className="size-4" aria-hidden="true" />
                  Deactivate
                </>
              ) : (
                <>
                  <UserCheck className="size-4" aria-hidden="true" />
                  Reinstate
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {saved && (
        <Banner tone="success" icon={CheckCircle2}>
          {saved} — re-sync the reader from Devices so it takes effect at the kiosk.
        </Banner>
      )}

      {error && (
        <Banner tone="danger" icon={AlertCircle}>
          {error}
        </Banner>
      )}

      {consentMissing && (
        <Banner tone="warn" icon={ShieldCheck}>
          No biometric consent is recorded for this staff member. Capture is blocked
          until consent has been given and recorded.
        </Banner>
      )}

      {!isAdmin && (
        <Banner tone="warn" icon={AlertCircle}>
          Only administrators can capture biometrics. You can view this record but not
          change it.
        </Banner>
      )}

      <div className="mt-6 space-y-6">
        <section className="rounded-card border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-medium text-slate-900">
            <Fingerprint className="size-4 text-slate-400" aria-hidden="true" />
            Fingerprints
            <span className="id-text ml-1 text-sm text-muted">
              {staff.fingerprints_enrolled} of 4
            </span>
          </h2>
          <p className="mt-1 text-sm text-muted">
            Capturing a finger that already exists replaces it. Two is the working
            minimum — one finger means no way in on a day that hand is bandaged.
          </p>

          <div className="mt-5">
            <FingerCapture
              captured={fingers}
              onCaptured={(finger) => void saveFinger(finger)}
              minQuality={MIN_QUALITY}
              disabled={!isAdmin || consentMissing}
              disabledReason={
                consentMissing
                  ? 'Biometric consent must be recorded first.'
                  : 'Administrators only.'
              }
            />
          </div>
        </section>

        <section className="rounded-card border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-medium text-slate-900">
            <ScanFace className="size-4 text-slate-400" aria-hidden="true" />
            Face
            <span className="id-text ml-1 text-sm text-muted">{faces.length} of 5</span>
          </h2>
          <p className="mt-1 text-sm text-muted">
            Re-capture after a significant change in appearance — a new beard or
            glasses will lower match scores.
          </p>

          <div className="mt-5">
            <FaceCapture
              captured={faces}
              onCaptured={(face) => void saveFace(face)}
              disabled={!isAdmin || consentMissing}
              disabledReason={
                consentMissing
                  ? 'Biometric consent must be recorded first.'
                  : 'Administrators only.'
              }
            />
          </div>
        </section>

        <section className="rounded-card border border-slate-200 bg-white p-5">
          <h2 className="font-medium text-slate-900">Record</h2>
          <dl className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
            <Row label="Staff number" value={staff.staff_no} mono />
            <Row label="Started" value={format(new Date(staff.starts_on), 'd MMM yyyy')} />
            <Row label="Phone" value={staff.phone ?? '—'} />
            <Row label="Email" value={staff.email ?? '—'} />
            <Row
              label="Consent"
              value={
                staff.consent_given && staff.consent_given_at
                  ? `Given ${format(new Date(staff.consent_given_at), 'd MMM yyyy')}`
                  : 'Not recorded'
              }
            />
          </dl>
        </section>
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={cn('text-sm text-slate-900', mono && 'id-text')}>{value}</dd>
    </div>
  )
}

function Banner({
  tone,
  icon: Icon,
  children,
}: {
  tone: 'success' | 'warn' | 'danger'
  icon: typeof AlertCircle
  children: React.ReactNode
}) {
  const styles = {
    success: 'border-success-500/20 bg-success-50 text-success-700',
    warn: 'border-warn-500/20 bg-warn-50 text-warn-700',
    danger: 'border-danger-500/20 bg-danger-50 text-danger-700',
  }[tone]

  return (
    <div className={cn('mb-3 flex items-start gap-2.5 rounded-control border px-4 py-3 text-sm', styles)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  )
}
