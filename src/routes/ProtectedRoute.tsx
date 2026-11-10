import { Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { Loader2, RefreshCw, WifiOff } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import type { ConsoleRole } from '@/types/database'

interface ProtectedRouteProps {
  children: ReactNode
  /** Omit to allow any signed-in console user. */
  allow?: ConsoleRole[]
}

/**
 * Route-level access control.
 *
 * This is a usability guard, not the security boundary — RLS in Postgres is.
 * A user who forces their way to /enrollment still cannot read a single
 * biometric row.
 */
export function ProtectedRoute({ children, allow }: ProtectedRouteProps) {
  const { session, profile, loading, profileReady, profileError, reloadProfile } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen message="Checking your session…" />

  if (!session) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  }

  // Signed in, but the profile fetch is still in flight. Waiting here is
  // what stops a valid admin being bounced to /no-access in the instant
  // between sign-in and the profile arriving.
  if (!profileReady) return <LoadingScreen message="Loading your profile…" />

  // The server could not be asked. That is not a refusal — say so and let
  // them retry, rather than telling a valid user they have no access.
  if (!profile && profileError) return <ConnectionProblem onRetry={reloadProfile} />

  // Resolved, and there genuinely is no profile row — an invited user who was
  // never provisioned. Send them somewhere honest rather than an empty console.
  if (!profile) {
    return <Navigate to="/no-access" replace />
  }

  if (!profile.is_active) {
    return <Navigate to="/no-access" replace />
  }

  if (allow && !allow.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

/** The profile could not be loaded at all. Retries on its own every 10 s. */
function ConnectionProblem({ onRetry }: { onRetry: () => Promise<void> }) {
  const [retrying, setRetrying] = useState(false)

  async function retry() {
    setRetrying(true)
    await onRetry()
    setRetrying(false)
  }

  useEffect(() => {
    const timer = setInterval(() => void onRetry(), 10_000)
    return () => clearInterval(timer)
  }, [onRetry])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
      <WifiOff className="size-8 text-slate-400" aria-hidden="true" />
      <h1 className="text-xl font-semibold text-slate-900">Cannot reach the server</h1>
      <p className="max-w-md text-sm text-muted">
        Your profile could not be loaded. Check the internet connection — this page tries
        again on its own every few seconds.
      </p>
      <button
        type="button"
        onClick={() => void retry()}
        disabled={retrying}
        className="mt-2 flex items-center gap-2 rounded-control bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {retrying ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
        Try again
      </button>
    </div>
  )
}
