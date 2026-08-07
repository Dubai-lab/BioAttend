import { useEffect, useState } from 'react'
import {
  Check,
  ChevronLeft,
  Loader2,
  ShieldCheck,
  UserPlus,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { recordAudit } from '@/lib/audit'
import { useAuth } from '@/lib/auth-context'
import {
  CATEGORY_LABELS,
  groupByCategory,
  nextStaffNumber,
  useReferenceData,
} from '@/lib/reference-data'
import { FingerCapture, type CapturedFinger } from '@/components/enrollment/FingerCapture'
import { FaceCapture, type CapturedFace } from '@/components/enrollment/FaceCapture'
import { cn, initials } from '@/lib/utils'

const STEPS = ['Identity', 'Role & shift', 'Fingerprints', 'Face', 'Review'] as const
type StepIndex = 0 | 1 | 2 | 3 | 4

/** Below this, a template is rejected rather than stored. */
const MIN_QUALITY = 40

interface FormState {
  staff_no: string
  full_name: string
  phone: string
  email: string
  department_id: string
  job_title_id: string
  starts_on: string
}

interface ConsentState {
  processing: boolean
  templateOnly: boolean
  withdrawal: boolean
}

export function Enrollment() {
  const { profile } = useAuth()
  const { departments, jobTitles, loading: refLoading } = useReferenceData()

  const [step, setStep] = useState<StepIndex>(0)
  const [form, setForm] = useState<FormState>({
    staff_no: '',
    full_name: '',
    phone: '',
    email: '',
    department_id: '',
    job_title_id: '',
    starts_on: new Date().toISOString().slice(0, 10),
  })
  const [consent, setConsent] = useState<ConsentState>({
    processing: false,
    templateOnly: false,
    withdrawal: false,
  })
  const [fingers, setFingers] = useState<CapturedFinger[]>([])
  const [faces, setFaces] = useState<CapturedFace[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedStaffNo, setSavedStaffNo] = useState<string | null>(null)

  // Suggest the next number so the operator does not have to look it up.
  useEffect(() => {
    void nextStaffNumber().then((value) =>
      setForm((prev) => (prev.staff_no ? prev : { ...prev, staff_no: value })),
    )
  }, [])

  const consentComplete = consent.processing && consent.templateOnly && consent.withdrawal
  const department = departments.find((d) => d.id === form.department_id)
  const jobTitle = jobTitles.find((t) => t.id === form.job_title_id)

  const stepValid: Record<StepIndex, boolean> = {
    0: form.staff_no.trim().length > 0 && form.full_name.trim().length > 0,
    1: form.department_id !== '' && form.job_title_id !== '',
    2: consentComplete && fingers.length >= 2,
    3: true, // face is optional — a staff member can be enrolled without it
    4: true,
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addFinger(finger: CapturedFinger) {
    setFingers((prev) => [...prev.filter((f) => f.position !== finger.position), finger])
  }

  function addFace(face: CapturedFace) {
    setFaces((prev) => [...prev.filter((f) => f.angle !== face.angle), face])
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    try {
      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .insert({
          staff_no: form.staff_no.trim(),
          full_name: form.full_name.trim(),
          department_id: form.department_id,
          job_title_id: form.job_title_id,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          starts_on: form.starts_on,
          consent_given: true,
          consent_given_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (staffError) throw new Error(staffError.message)

      const { error: templateError } = await supabase.from('fingerprint_templates').insert(
        fingers.map((finger) => ({
          staff_id: staff.id,
          finger: finger.position,
          template: finger.template,
          quality: finger.quality,
          enrolled_by: profile?.id ?? null,
        })),
      )

      if (templateError) {
        // The staff row exists but has no biometrics. Say so plainly — it
        // will show as incomplete in the directory and can be finished later.
        throw new Error(
          `Staff record created, but the fingerprints failed to save: ${templateError.message}`,
        )
      }

      if (faces.length > 0) {
        // pgvector accepts the array as a bracketed string.
        const { error: faceError } = await supabase.from('face_embeddings').insert(
          faces.map((face) => ({
            staff_id: staff.id,
            embedding: `[${face.embedding.join(',')}]`,
            angle: face.angle,
            quality: face.quality,
            enrolled_by: profile?.id ?? null,
          })),
        )

        if (faceError) {
          throw new Error(
            `Staff and fingerprints saved, but the face data failed: ${faceError.message}. ` +
              'The staff member can still check in by fingerprint.',
          )
        }
      }

      await recordAudit(profile?.id, 'staff.enrolled', 'staff', staff.id, {
        staff_no: staff.staff_no,
        fingerprints: fingers.length,
        face_angles: faces.length,
      })

      setSavedStaffNo(staff.staff_no)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setSavedStaffNo(null)
    setStep(0)
    setFingers([])
    setFaces([])
    setConsent({ processing: false, templateOnly: false, withdrawal: false })
    setForm((prev) => ({
      ...prev,
      full_name: '',
      phone: '',
      email: '',
    }))
    void nextStaffNumber().then((value) => update('staff_no', value))
  }

  if (savedStaffNo) {
    return (
      <div className="px-8 py-6">
        <div className="mx-auto max-w-md rounded-card border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-success-50 text-success-700">
            <Check className="size-6" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Staff enrolled</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="id-text">{savedStaffNo}</span> was created with{' '}
            {fingers.length} fingerprint {fingers.length === 1 ? 'template' : 'templates'}
            {faces.length > 0 && ` and ${faces.length} face angles`}.
          </p>
          <p className="mt-3 text-xs text-muted">
            Templates are stored in the database. They will be written to a reader the
            next time that device is synced.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 w-full rounded-control bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Enrol another staff member
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-8 py-6">
      {/* Stepper */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Enrol new staff — step {step + 1} of {STEPS.length}
          </h1>
        </div>

        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {STEPS.map((label, index) => {
            const done = index < step
            const current = index === step
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full text-[11px] font-medium',
                    done
                      ? 'bg-brand-600 text-white'
                      : current
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-200 text-slate-500',
                  )}
                >
                  {done ? <Check className="size-3" aria-hidden="true" /> : index + 1}
                </span>
                <span className={cn(current ? 'font-medium text-slate-900' : 'text-muted')}>
                  {label}
                </span>
                {index < STEPS.length - 1 && (
                  <span className="mx-1 hidden h-px w-6 bg-slate-300 sm:block" />
                )}
              </li>
            )
          })}
        </ol>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main panel */}
        <section className="rounded-card border border-slate-200 bg-white p-6">
          {refLoading ? (
            <div className="flex items-center gap-2 py-12 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading departments and roles…
            </div>
          ) : (
            <>
              {step === 0 && (
                <StepIdentity form={form} update={update} />
              )}

              {step === 1 && (
                <StepRole
                  form={form}
                  update={update}
                  departments={departments}
                  jobTitles={jobTitles}
                />
              )}

              {step === 2 && (
                <div>
                  <h2 className="font-medium text-slate-900">Capture fingerprint templates</h2>
                  <p className="mt-1 text-sm text-muted">
                    Four fingers. Each finger is scanned three times; the merged
                    template is retained. At least two are required.
                  </p>

                  <div className="mt-5">
                    <FingerCapture
                      captured={fingers}
                      onCaptured={addFinger}
                      minQuality={MIN_QUALITY}
                      disabled={!consentComplete}
                      disabledReason="Biometric consent must be recorded before any capture. Complete the consent panel on the right."
                    />
                  </div>

                  <dl className="mt-6 grid grid-cols-3 gap-3">
                    <Stat label="Captured" value={`${fingers.length} of 4`} />
                    <Stat label="Minimum quality" value={`${MIN_QUALITY}`} />
                    <Stat
                      label="Average quality"
                      value={
                        fingers.length
                          ? `${Math.round(
                              fingers.reduce((sum, f) => sum + f.quality, 0) / fingers.length,
                            )}`
                          : '—'
                      }
                    />
                  </dl>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="font-medium text-slate-900">Capture face</h2>
                  <p className="mt-1 text-sm text-muted">
                    Five angles. Face is a second factor at check-in and the fallback
                    when a finger will not read — optional, but staff without it have
                    no way in on a day their hands are bandaged.
                  </p>

                  <div className="mt-5">
                    <FaceCapture
                      captured={faces}
                      onCaptured={addFace}
                      disabled={!consentComplete}
                      disabledReason="Biometric consent must be recorded before any capture. Complete the consent panel on the right."
                    />
                  </div>
                </div>
              )}

              {step === 4 && (
                <StepReview
                  form={form}
                  department={department?.name ?? '—'}
                  jobTitle={jobTitle?.title ?? '—'}
                  fingers={fingers}
                  faces={faces}
                  saving={saving}
                  error={saveError}
                />
              )}
            </>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1) as StepIndex)}
              disabled={step === 0 || saving}
              className="flex items-center gap-1.5 rounded-control border border-slate-300 px-4 py-2
                         text-sm font-medium text-slate-700 hover:bg-slate-50
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Back
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(4, s + 1) as StepIndex)}
                disabled={!stepValid[step]}
                className="rounded-control bg-brand-600 px-4 py-2 text-sm font-medium text-white
                           hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex items-center gap-2 rounded-control bg-brand-600 px-4 py-2 text-sm
                           font-medium text-white hover:bg-brand-700
                           disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {saving ? 'Saving…' : 'Save staff member'}
              </button>
            )}
          </div>
        </section>

        {/* Context rail */}
        <aside className="space-y-4">
          <section className="rounded-card border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-medium text-slate-900">Enrolling</h2>
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-800">
                {initials(form.full_name) || <UserPlus className="size-4" aria-hidden="true" />}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">
                  {form.full_name || 'New staff member'}
                </p>
                <p className="truncate text-xs text-muted">
                  {jobTitle?.title ?? 'Role not set'} · {department?.name ?? 'No department'}
                </p>
                <p className="id-text mt-0.5 text-xs text-muted">{form.staff_no}</p>
              </div>
            </div>
          </section>

          <ConsentPanel consent={consent} setConsent={setConsent} />
        </aside>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function StepIdentity({
  form,
  update,
}: {
  form: FormState
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void
}) {
  return (
    <div>
      <h2 className="font-medium text-slate-900">Identity</h2>
      <p className="mt-1 text-sm text-muted">
        The staff number is suggested from the highest existing one; change it if your
        hospital uses a different scheme.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Staff number" required>
          <input
            value={form.staff_no}
            onChange={(e) => update('staff_no', e.target.value)}
            className="id-text w-full rounded-control border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          />
        </Field>

        <Field label="Full name" required>
          <input
            value={form.full_name}
            onChange={(e) => update('full_name', e.target.value)}
            placeholder="Ruth Adegoke"
            className="w-full rounded-control border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          />
        </Field>

        <Field label="Phone">
          <input
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+250 7.. ... ..."
            className="w-full rounded-control border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          />
        </Field>

        <Field label="Email">
          <input
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            className="w-full rounded-control border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          />
        </Field>
      </div>

      <p className="mt-4 text-xs text-muted">
        Staff do not receive login accounts. Contact details are for the roster only.
      </p>
    </div>
  )
}

function StepRole({
  form,
  update,
  departments,
  jobTitles,
}: {
  form: FormState
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  departments: { id: string; name: string }[]
  jobTitles: { id: string; title: string; category: string }[]
}) {
  return (
    <div>
      <h2 className="font-medium text-slate-900">Role &amp; shift</h2>
      <p className="mt-1 text-sm text-muted">
        Department decides which supervisor sees this person&apos;s attendance.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Department" required>
          <select
            value={form.department_id}
            onChange={(e) => update('department_id', e.target.value)}
            className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          >
            <option value="">Select a department…</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Job title" required>
          <select
            value={form.job_title_id}
            onChange={(e) => update('job_title_id', e.target.value)}
            className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          >
            <option value="">Select a job title…</option>
            {groupByCategory(jobTitles as never).map(([category, titles]) => (
              <optgroup key={category} label={CATEGORY_LABELS[category]}>
                {titles.map((title) => (
                  <option key={title.id} value={title.id}>
                    {title.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <Field label="Start date">
          <input
            type="date"
            value={form.starts_on}
            onChange={(e) => update('starts_on', e.target.value)}
            className="w-full rounded-control border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          />
        </Field>
      </div>
    </div>
  )
}

function StepReview({
  form,
  department,
  jobTitle,
  fingers,
  faces,
  saving,
  error,
}: {
  form: FormState
  department: string
  jobTitle: string
  fingers: CapturedFinger[]
  faces: CapturedFace[]
  saving: boolean
  error: string | null
}) {
  return (
    <div>
      <h2 className="font-medium text-slate-900">Review</h2>
      <p className="mt-1 text-sm text-muted">
        Check the details before saving. Biometric templates are written to the
        database, not to the reader — readers are synced separately.
      </p>

      <dl className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
        <ReviewRow label="Staff number" value={form.staff_no} mono />
        <ReviewRow label="Full name" value={form.full_name} />
        <ReviewRow label="Department" value={department} />
        <ReviewRow label="Job title" value={jobTitle} />
        <ReviewRow label="Start date" value={form.starts_on} mono />
        <ReviewRow label="Phone" value={form.phone || '—'} />
        <ReviewRow label="Email" value={form.email || '—'} />
        <ReviewRow
          label="Fingerprints"
          value={
            fingers.length
              ? `${fingers.length} captured (${fingers.map((f) => f.position.replace('_', ' ')).join(', ')})`
              : 'None'
          }
        />
        <ReviewRow
          label="Face"
          value={
            faces.length
              ? `${faces.length} of 5 angles (${faces.map((f) => f.angle).join(', ')})`
              : 'Not captured'
          }
        />
      </dl>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-control border border-danger-500/20 bg-danger-50 px-4 py-3 text-sm text-danger-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {saving && (
        <p className="mt-4 text-sm text-muted">Writing staff record and templates…</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

function ConsentPanel({
  consent,
  setConsent,
}: {
  consent: ConsentState
  setConsent: React.Dispatch<React.SetStateAction<ConsentState>>
}) {
  const items: { key: keyof ConsentState; label: string; detail: string }[] = [
    {
      key: 'processing',
      label: 'Biometric processing consent',
      detail: 'Explained verbally and in writing, and agreed to',
    },
    {
      key: 'templateOnly',
      label: 'Template-only storage acknowledged',
      detail: 'No fingerprint or face images are retained',
    },
    {
      key: 'withdrawal',
      label: 'Right to withdraw explained',
      detail: 'Falls back to staff ID with supervisor sign-off',
    },
  ]

  return (
    <section className="rounded-card border border-slate-200 bg-white p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-900">
        <ShieldCheck className="size-4 text-brand-600" aria-hidden="true" />
        Consent &amp; data protection
      </h2>
      <p className="mb-3 text-xs text-muted">
        All three are required before any biometric capture.
      </p>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.key}>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={consent[item.key]}
                onChange={(e) =>
                  setConsent((prev) => ({ ...prev, [item.key]: e.target.checked }))
                }
                className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
              />
              <span>
                <span className="block text-sm text-slate-800">{item.label}</span>
                <span className="block text-xs text-muted">{item.detail}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-danger-500"> *</span>}
      </span>
      {children}
    </label>
  )
}

function ReviewRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={cn('text-right text-sm text-slate-900', mono && 'id-text')}>{value}</dd>
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
