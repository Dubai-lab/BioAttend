import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Fingerprint,
  Loader2,
  Save,
  ScanFace,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useReferenceData } from '@/lib/reference-data'
import { useAuth } from '@/lib/auth-context'
import { recordAudit } from '@/lib/audit'
import { cn } from '@/lib/utils'
import type { Shift } from '@/types/database'

interface HospitalSettings {
  hospital_name: string
  system_name: string
  timezone: string
  face_match_threshold: number
  face_match_margin: number
  fingerprint_min_quality: number
  min_shift_duration_min: number
}

export function Settings() {
  const { profile } = useAuth()
  const { shifts: initialShifts } = useReferenceData()

  const [settings, setSettings] = useState<HospitalSettings | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => setShifts(initialShifts), [initialShifts])

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('hospital_settings')
      .select('*')
      .eq('id', true)
      .maybeSingle()

    if (loadError) setError(loadError.message)
    else if (data) setSettings(data as unknown as HospitalSettings)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function update<K extends keyof HospitalSettings>(key: K, value: HospitalSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
    setSaved(false)
  }

  function updateShift(id: string, patch: Partial<Shift>) {
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    setSaved(false)
  }

  async function save() {
    if (!settings) return
    setSaving(true)
    setError(null)

    const { error: settingsError } = await supabase
      .from('hospital_settings')
      .update({
        face_match_threshold: settings.face_match_threshold,
        face_match_margin: settings.face_match_margin,
        fingerprint_min_quality: settings.fingerprint_min_quality,
        min_shift_duration_min: settings.min_shift_duration_min,
        timezone: settings.timezone,
      })
      .eq('id', true)

    if (settingsError) {
      setError(settingsError.message)
      setSaving(false)
      return
    }

    for (const shift of shifts) {
      const { error: shiftError } = await supabase
        .from('shifts')
        .update({
          checkin_opens_before_min: shift.checkin_opens_before_min,
          checkin_grace_after_min: shift.checkin_grace_after_min,
          checkout_opens_before_min: shift.checkout_opens_before_min,
          checkout_closes_after_min: shift.checkout_closes_after_min,
        })
        .eq('id', shift.id)

      if (shiftError) {
        setError(shiftError.message)
        setSaving(false)
        return
      }
    }

    await recordAudit(profile?.id, 'settings.updated', 'hospital_settings', null, {
      face_match_threshold: settings.face_match_threshold,
      face_match_margin: settings.face_match_margin,
      fingerprint_min_quality: settings.fingerprint_min_quality,
      min_shift_duration_min: settings.min_shift_duration_min,
    })

    setSaved(true)
    setSaving(false)
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center gap-2 px-8 py-12 text-sm text-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading settings…
      </div>
    )
  }

  return (
    <div className="px-8 py-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-muted">
            Shift windows, thresholds and hospital details
          </p>
        </div>

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="flex items-center gap-2 rounded-control bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          Save changes
        </button>
      </header>

      {saved && (
        <Banner tone="success" icon={CheckCircle2}>
          Settings saved. Threshold changes take effect on the next scan; shift window
          changes apply from the next check-in.
        </Banner>
      )}

      {error && (
        <Banner tone="danger" icon={AlertCircle}>
          {error}
        </Banner>
      )}

      <div className="space-y-6">
        {/* Shift windows */}
        <section className="rounded-card border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-medium text-slate-900">
            <Clock className="size-4 text-slate-400" aria-hidden="true" />
            Shift windows
          </h2>
          <p className="mt-1 text-sm text-muted">
            Minutes either side of a shift during which the kiosk accepts a scan.
            Outside these windows the system records nothing — it does not quietly
            switch to checking people out.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <Th>Shift</Th>
                  <Th>Check-in opens before</Th>
                  <Th>Grace after start</Th>
                  <Th>Check-out opens before</Th>
                  <Th>Check-out closes after</Th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => (
                  <tr key={shift.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900">{shift.name}</p>
                      <p className="id-text text-xs text-muted">
                        {shift.starts_at.slice(0, 5)}–{shift.ends_at.slice(0, 5)}
                        {shift.crosses_midnight && ' (+1d)'}
                      </p>
                    </td>
                    <MinutesCell
                      value={shift.checkin_opens_before_min}
                      onChange={(v) => updateShift(shift.id, { checkin_opens_before_min: v })}
                    />
                    <MinutesCell
                      value={shift.checkin_grace_after_min}
                      onChange={(v) => updateShift(shift.id, { checkin_grace_after_min: v })}
                    />
                    <MinutesCell
                      value={shift.checkout_opens_before_min}
                      onChange={(v) => updateShift(shift.id, { checkout_opens_before_min: v })}
                    />
                    <MinutesCell
                      value={shift.checkout_closes_after_min}
                      onChange={(v) => updateShift(shift.id, { checkout_closes_after_min: v })}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-muted">
            Arrivals after the grace window are still recorded, flagged for supervisor
            approval. A scan is never silently discarded.
          </p>
        </section>

        {/* Biometric thresholds */}
        <section className="rounded-card border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-medium text-slate-900">
            <ScanFace className="size-4 text-slate-400" aria-hidden="true" />
            Face matching
          </h2>
          <p className="mt-1 text-sm text-muted">
            These are the two numbers that decide whether the wrong person can be
            checked in. Measure them against your test subjects rather than guessing.
          </p>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Slider
              label="Match threshold"
              value={settings.face_match_threshold}
              min={0.4}
              max={0.99}
              step={0.01}
              onChange={(v) => update('face_match_threshold', v)}
              help="Minimum similarity to accept. Higher rejects impostors but also turns away legitimate staff in poor light."
            />
            <Slider
              label="Margin over runner-up"
              value={settings.face_match_margin}
              min={0.0}
              max={0.4}
              step={0.01}
              onChange={(v) => update('face_match_margin', v)}
              help="How far ahead the best match must be. This is what refuses to choose between two similar-looking people."
            />
          </div>
        </section>

        <section className="rounded-card border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-medium text-slate-900">
            <Fingerprint className="size-4 text-slate-400" aria-hidden="true" />
            Fingerprint &amp; attendance
          </h2>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <NumberField
              label="Minimum template quality"
              value={settings.fingerprint_min_quality}
              min={0}
              max={100}
              onChange={(v) => update('fingerprint_min_quality', v)}
              help="Captures below this are rejected at enrolment. A weak template means failed check-ins every morning."
            />
            <NumberField
              label="Minimum shift duration (minutes)"
              value={settings.min_shift_duration_min}
              min={0}
              max={720}
              onChange={(v) => update('min_shift_duration_min', v)}
              help="Guards against a second scan moments after arriving being read as leaving."
            />
          </div>
        </section>

        <section className="rounded-card border border-slate-200 bg-white p-5">
          <h2 className="font-medium text-slate-900">Hospital</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <NumberFieldText
              label="Timezone"
              value={settings.timezone}
              onChange={(v) => update('timezone', v)}
              help="IANA name. Attendance dates and shift windows are computed in this zone."
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function MinutesCell({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <td className="px-3 py-2">
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={240}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="id-text w-20 rounded-control border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
        />
        <span className="text-xs text-muted">min</span>
      </div>
    </td>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  help,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  help: string
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="id-text text-sm text-slate-900">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-600"
      />
      <span className="mt-1 block text-xs text-muted">{help}</span>
    </label>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
  help,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  help: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="id-text w-32 rounded-control border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
      />
      <span className="mt-1 block text-xs text-muted">{help}</span>
    </label>
  )
}

function NumberFieldText({
  label,
  value,
  onChange,
  help,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  help: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="id-text w-full rounded-control border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
      />
      <span className="mt-1 block text-xs text-muted">{help}</span>
    </label>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
      {children}
    </th>
  )
}

function Banner({
  tone,
  icon: Icon,
  children,
}: {
  tone: 'success' | 'danger'
  icon: typeof AlertCircle
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'mb-4 flex items-start gap-2.5 rounded-control border px-4 py-3 text-sm',
        tone === 'success'
          ? 'border-success-500/20 bg-success-50 text-success-700'
          : 'border-danger-500/20 bg-danger-50 text-danger-700',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  )
}
