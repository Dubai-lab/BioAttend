import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
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
  const { session, profile, loading, profileReady } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen message="Checking your session…" />

  if (!session) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  }

  // Signed in, but the profile fetch is still in flight. Waiting here is
  // what stops a valid admin being bounced to /no-access in the instant
  // between sign-in and the profile arriving.
  if (!profileReady) return <LoadingScreen message="Loading your profile…" />

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
