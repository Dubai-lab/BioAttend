import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Monitor,
  ShieldCheck,
  UserPlus,
  UserX,
  Eye,
  EyeOff,
  Mail,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useReferenceData } from '@/lib/reference-data'
import { recordAudit } from '@/lib/audit'
import { createConsoleUser, sendPasswordReset } from '@/lib/provisioning'
import { cn, initials } from '@/lib/utils'
import type { ConsoleRole, Kiosk, Profile } from '@/types/database'

/**
 * Console access: who can sign in, and which stations can record attendance.
 *
 * Both used to require editing SQL by hand. Neither should — an administrator
 * needs to add a departmental supervisor or replace a broken kiosk without a
 * developer.
 */
export function Access() {
  const { profile } = useAuth()
  const { departments } = useReferenceData()

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [profileResult, kioskResult] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('kiosks').select('*').order('code'),
    ])
    setProfiles(profileResult.data ?? [])
    setKiosks(kioskResult.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-8 py-12 text-sm text-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading…
      </div>
    )
  }

  return (
    <div className="px-8 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Access</h1>
        <p className="mt-1 text-sm text-muted">Console users and check-in stations</p>
      </header>

      {notice && (
        <Banner tone="success" icon={CheckCircle2}>
          {notice}
        </Banner>
      )}
      {error && (
        <Banner tone="danger" icon={AlertCircle}>
          {error}
        </Banner>
      )}

      <div className="space-y-6">
        <ConsoleUsers
          profiles={profiles}
          departments={departments}
          currentId={profile?.id}
          actorId={profile?.id}
          onChanged={(message) => {
            setNotice(message)
            setError(null)
            void load()
          }}
          onError={(message) => {
            setError(message)
            setNotice(null)
          }}
        />

        <Kiosks
          kiosks={kiosks}
          actorId={profile?.id}
          onChanged={(message) => {
            setNotice(message)
            setError(null)
            void load()
          }}
          onError={(message) => {
            setError(message)
            setNotice(null)
          }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Console users
// ---------------------------------------------------------------------------

function ConsoleUsers({
  profiles,
  departments,
  currentId,
  actorId,
  onChanged,
  onError,
}: {
  profiles: Profile[]
  departments: { id: string; name: string }[]
  currentId?: string
  actorId?: string
  onChanged: (message: string) => void
  onError: (message: string) => void
}) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState(() => generatePassword())
  const [showPassword, setShowPassword] = useState(true)
  const [role, setRole] = useState<ConsoleRole>('supervisor')
  const [departmentId, setDepartmentId] = useState('')
  const [busy, setBusy] = useState(false)

  const departmentName = new Map(departments.map((d) => [d.id, d.name]))

  async function createUser() {
    setBusy(true)
    const result = await createConsoleUser({
      email,
      password,
      fullName,
      role,
      departmentId: departmentId || null,
    })
    setBusy(false)

    if (!result.ok) return onError(result.message)

    await recordAudit(actorId, 'supervisor.assigned', 'profiles', null, {
      email,
      role,
      department: departmentName.get(departmentId) ?? null,
      account_created: result.created,
    })

    onChanged(
      result.created
        ? `${fullName} can now sign in with the password you set.`
        : `${fullName} already had an account — the role has been updated.`,
    )

    setEmail('')
    setFullName('')
    setPassword(generatePassword())
  }

  /** For when a supervisor forgets theirs — no admin can read it back. */
  async function resetPassword(target: Profile) {
    const message = await sendPasswordReset(target.email)
    if (message) return onError(message)
    onChanged(`Password reset link sent to ${target.email}.`)
  }

  async function revoke(target: Profile) {
    const { data, error } = await supabase.rpc('revoke_console_access', {
      p_profile_id: target.id,
    })
    if (error) return onError(error.message)

    const result = data as { ok: boolean; reason?: string }
    if (!result?.ok) {
      return onError(
        result?.reason === 'cannot_revoke_self'
          ? 'You cannot revoke your own access.'
          : 'Could not revoke access.',
      )
    }

    await recordAudit(actorId, 'supervisor.removed', 'profiles', target.id, {
      email: target.email,
    })
    onChanged(`${target.full_name} can no longer sign in.`)
  }

  return (
    <section className="rounded-card border border-slate-200 bg-white p-5">
      <h2 className="flex items-center gap-2 font-medium text-slate-900">
        <ShieldCheck className="size-4 text-slate-400" aria-hidden="true" />
        Console users
      </h2>
      <p className="mt-1 text-sm text-muted">
        Administrators see the whole hospital. Supervisors see only their own
        department — enforced by the database, not the menu.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <Th>User</Th>
              <Th>Role</Th>
              <Th>Department</Th>
              <Th>Status</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((person) => (
              <tr key={person.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 items-center justify-center rounded-full bg-brand-100 text-[11px] font-medium text-brand-800">
                      {initials(person.full_name)}
                    </span>
                    <div>
                      <p className="font-medium text-slate-900">{person.full_name}</p>
                      <p className="text-xs text-muted">{person.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 capitalize text-slate-700">{person.role}</td>
                <td className="px-3 py-2.5 text-slate-700">
                  {person.role === 'admin'
                    ? 'All'
                    : (departmentName.get(person.department_id ?? '') ?? '—')}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs',
                      person.is_active
                        ? 'bg-success-50 text-success-700'
                        : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {person.is_active ? 'Active' : 'Revoked'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => void resetPassword(person)}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:underline"
                    >
                      <Mail className="size-3.5" aria-hidden="true" />
                      Reset password
                    </button>
                    {person.is_active && person.id !== currentId && (
                      <button
                        type="button"
                        onClick={() => void revoke(person)}
                        className="inline-flex items-center gap-1.5 text-xs text-danger-700 hover:underline"
                      >
                        <UserX className="size-3.5" aria-hidden="true" />
                        Revoke
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-control border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-medium text-slate-800">Add a console user</h3>
        <p className="mt-1 text-xs text-muted">
          Creates the sign-in account and assigns the role. Hand them the password —
          they can change it later using the reset link.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Work email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@northcrest.rw"
              className="w-full rounded-control border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            />
          </Field>

          <Field label="Full name">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-control border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            />
          </Field>

          <Field label="Role">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ConsoleRole)}
              className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            >
              <option value="supervisor">Supervisor</option>
              <option value="admin">Administrator</option>
            </select>
          </Field>

          <Field label="Password">
            <div className="flex gap-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="id-text w-full rounded-control border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="rounded-control border border-slate-300 bg-white px-2.5 text-slate-600 hover:bg-slate-50"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                className="rounded-control border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                New
              </button>
            </div>
          </Field>

          {role === 'supervisor' && (
            <Field label="Department">
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
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
          )}
        </div>

        <button
          type="button"
          onClick={() => void createUser()}
          disabled={
            busy ||
            !email.trim() ||
            !fullName.trim() ||
            password.length < 8 ||
            (role === 'supervisor' && !departmentId)
          }
          className="mt-3 flex items-center gap-2 rounded-control bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <UserPlus className="size-4" aria-hidden="true" />
          )}
          Create console user
        </button>

        <p className="mt-2 text-xs text-muted">
          Write the password down before saving. Nobody can read it back afterwards —
          only replace it with a reset link.
        </p>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Kiosks
// ---------------------------------------------------------------------------

function Kiosks({
  kiosks,
  actorId,
  onChanged,
  onError,
}: {
  kiosks: Kiosk[]
  actorId?: string
  onChanged: (message: string) => void
  onError: (message: string) => void
}) {
  const [code, setCode] = useState('KIOSK-')
  const [label, setLabel] = useState('')
  const [location, setLocation] = useState('')
  const [readerId, setReaderId] = useState('HR-DESK-01')
  const [token, setToken] = useState(() => generateToken())
  const [busy, setBusy] = useState(false)
  const [issued, setIssued] = useState<{ code: string; token: string } | null>(null)

  async function register() {
    setBusy(true)
    const { data, error } = await supabase.rpc('register_kiosk', {
      p_code: code,
      p_label: label,
      p_location: location,
      p_reader_id: readerId,
      p_token: token,
    })
    setBusy(false)

    if (error) return onError(error.message)

    const result = data as { ok: boolean; reason?: string }
    if (!result?.ok) {
      return onError(
        result?.reason === 'token_too_short'
          ? 'The token must be at least 12 characters.'
          : result?.reason === 'not_admin'
            ? 'Administrators only.'
            : 'Could not register the station.',
      )
    }

    await recordAudit(actorId, 'kiosk.registered', 'kiosks', null, { code, label })

    // Shown once. Only the bcrypt hash is stored, so it cannot be recovered.
    setIssued({ code, token })
    setToken(generateToken())
    onChanged(`Station ${code} registered.`)
  }

  return (
    <section className="rounded-card border border-slate-200 bg-white p-5">
      <h2 className="flex items-center gap-2 font-medium text-slate-900">
        <Monitor className="size-4 text-slate-400" aria-hidden="true" />
        Check-in stations
      </h2>
      <p className="mt-1 text-sm text-muted">
        Attendance can only be written by a registered station. The token belongs to
        the machine, not to a person — treat it like a door key.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <Th>Code</Th>
              <Th>Location</Th>
              <Th>Reader</Th>
              <Th>Last seen</Th>
            </tr>
          </thead>
          <tbody>
            {kiosks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted">
                  No stations registered yet.
                </td>
              </tr>
            )}
            {kiosks.map((kiosk) => (
              <tr key={kiosk.id} className="border-b border-slate-100 last:border-0">
                <td className="id-text px-3 py-2.5 text-slate-900">{kiosk.code}</td>
                <td className="px-3 py-2.5 text-slate-700">{kiosk.location ?? '—'}</td>
                <td className="id-text px-3 py-2.5 text-slate-700">
                  {kiosk.reader_id ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-slate-700">
                  {kiosk.last_seen_at
                    ? new Date(kiosk.last_seen_at).toLocaleString()
                    : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {issued && (
        <div className="mt-4 rounded-control border border-warn-500/30 bg-warn-50 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-warn-700">
            <KeyRound className="size-4" aria-hidden="true" />
            Token for {issued.code} — shown once
          </p>
          <p className="mt-1 text-xs text-warn-700/90">
            Only its hash is stored. Copy it now and enter it at that station; it
            cannot be recovered later, only replaced.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="id-text flex-1 rounded bg-white px-3 py-2 text-sm text-slate-900">
              {issued.token}
            </code>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(issued.token)}
              className="flex items-center gap-1.5 rounded-control border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Copy className="size-3.5" aria-hidden="true" />
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 rounded-control border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-medium text-slate-800">
          Register a station, or rotate its token
        </h3>
        <p className="mt-1 text-xs text-muted">
          Using an existing code replaces that station&apos;s token — the way to
          respond to a token being exposed.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Station code">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="id-text w-full rounded-control border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            />
          </Field>
          <Field label="Label">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Main entrance kiosk"
              className="w-full rounded-control border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            />
          </Field>
          <Field label="Location">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ground floor, main entrance"
              className="w-full rounded-control border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            />
          </Field>
          <Field label="Attached reader">
            <input
              value={readerId}
              onChange={(e) => setReaderId(e.target.value)}
              className="id-text w-full rounded-control border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Token (generated — change it if you prefer)">
            <div className="flex gap-2">
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="id-text flex-1 rounded-control border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setToken(generateToken())}
                className="rounded-control border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Regenerate
              </button>
            </div>
          </Field>
        </div>

        <button
          type="button"
          onClick={() => void register()}
          disabled={busy || code.length < 4 || !label.trim() || token.length < 12}
          className="mt-3 flex items-center gap-2 rounded-control bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Monitor className="size-4" aria-hidden="true" />
          )}
          Register station
        </button>
      </div>
    </section>
  )
}

/**
 * Readable starting password.
 *
 * Ambiguous characters are left out, because this gets written on paper and
 * typed back — nobody should have to guess whether that was a 0 or an O.
 */
function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

/** Random token using the browser's CSPRNG — never Math.random for a secret. */
function generateToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)

  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    if (i > 0 && i % 6 === 0) out += '-'
    out += alphabet[bytes[i] % alphabet.length]
  }
  return out
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      {children}
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
