import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

/**
 * Shown when a signed-in user has no active console profile.
 *
 * It used to be a dead end: once here, a valid user stayed here even after
 * their profile could be read again. It now leaves by itself the moment an
 * active profile is present, and offers a retry and a way to sign out.
 */
export function NoAccess() {
  const { session, profile, reloadProfile, signOut } = useAuth()
  const [checking, setChecking] = useState(false)

  if (!session) return <Navigate to="/sign-in" replace />
  if (profile?.is_active) return <Navigate to="/" replace />

  async function retry() {
    setChecking(true)
    await reloadProfile()
    setChecking(false)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
      <h1 className="text-xl font-semibold text-slate-900">No console access</h1>
      <p className="max-w-md text-sm text-muted">
        {profile && !profile.is_active
          ? 'Your console account has been deactivated. Contact an administrator if you need access again.'
          : 'Your account is signed in but has no active console profile. An administrator needs to assign you a role before you can continue.'}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void retry()}
          disabled={checking}
          className="flex items-center gap-2 rounded-control bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {checking ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
          Try again
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex items-center gap-2 rounded-control border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  )
}
