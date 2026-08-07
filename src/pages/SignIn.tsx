import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Fingerprint, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { LoadingScreen } from '@/components/ui/LoadingScreen'

export function SignIn() {
  const { session, loading, signIn } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <LoadingScreen message="Checking your session…" />

  if (session) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error: signInError } = await signIn(email.trim(), password)

    if (signInError === 'NETWORK') {
      setError(
        'Cannot reach the server. Check your internet connection, or confirm ' +
          'VITE_SUPABASE_URL points at a live project.',
      )
      setSubmitting(false)
    } else if (signInError) {
      // Deliberately does not distinguish "no such user" from "wrong
      // password" — that difference tells an attacker which hospital emails
      // are real.
      setError('Email or password is incorrect.')
      setSubmitting(false)
    }
    // On success the auth listener redirects; leave the button disabled.
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden flex-1 flex-col justify-between bg-shell-900 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand-500 text-white">
            <Fingerprint className="size-6" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <p className="text-lg font-semibold text-white">BioAttend</p>
            <p className="text-xs uppercase tracking-wider text-slate-400">
              Northcrest General
            </p>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight text-white">
            Biometric staff attendance &amp; shift management
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Fingerprint and facial recognition, verified at the point of care.
            Staff check in at a kiosk — this console is for administrators and
            department supervisors.
          </p>
        </div>

        <p className="text-xs text-slate-500">
          Biometric templates are stored as irreversible mathematical
          representations. No fingerprint or face images are retained.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-brand-500 text-white">
              <Fingerprint className="size-6" aria-hidden="true" />
            </div>
            <p className="text-lg font-semibold">BioAttend</p>
          </div>

          <h2 className="text-2xl font-semibold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-muted">
            Administrator and supervisor access only.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Work email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm
                           placeholder:text-slate-400 focus:border-brand-500 focus:ring-2
                           focus:ring-brand-500/20 focus:outline-none"
                placeholder="name@northcrest.rw"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm
                           focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20
                           focus:outline-none"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-control border border-danger-500/20
                           bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-control bg-brand-600
                         px-4 py-2.5 text-sm font-medium text-white transition-colors
                         hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
