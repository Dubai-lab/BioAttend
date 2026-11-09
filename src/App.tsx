import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { Landing } from '@/pages/Landing'
import { Privacy } from '@/pages/Privacy'
import { Terms } from '@/pages/Terms'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { ConsoleLayout } from '@/components/layout/ConsoleLayout'
import { SignIn } from '@/pages/SignIn'
import { Devices } from '@/pages/Devices'
import { Enrollment } from '@/pages/Enrollment'
import { StaffDirectory } from '@/pages/StaffDirectory'
import { StaffDetail } from '@/pages/StaffDetail'
import { Settings } from '@/pages/Settings'
import { Reports } from '@/pages/Reports'
import { Overview } from '@/pages/Overview'
import { AuditLog } from '@/pages/AuditLog'
import { Access } from '@/pages/Access'
import { ShiftRoster } from '@/pages/ShiftRoster'
import { Kiosk } from '@/pages/Kiosk'
import { LiveAttendance } from '@/pages/LiveAttendance'
import { Exceptions } from '@/pages/Exceptions'
import { NoAccess } from '@/pages/Placeholder'

/**
 * `/` is both the public landing page and the console overview.
 *
 * A signed-out visitor at `/` sees the landing page. Anyone signed in — and
 * any signed-out visit to a deeper console route such as /live — goes through
 * ProtectedRoute exactly as before, so console links and redirects are
 * unchanged.
 */
function ConsoleGate() {
  const { session, loading } = useAuth()
  const { pathname } = useLocation()

  if (!loading && !session && pathname === '/') return <Landing />

  return (
    <ProtectedRoute>
      <ConsoleLayout />
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/no-access" element={<NoAccess />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          {/*
            Kiosk lives outside the console entirely — no sidebar, no login,
            its own visual density. Built in a later phase.
          */}
          <Route
            path="/kiosk"
            element={<Kiosk />}
          />

          {/* Console — Admin and Supervisor */}
          <Route element={<ConsoleGate />}>
            <Route
              index
              element={<Overview />}
            />
            <Route
              path="live"
              element={<LiveAttendance />}
            />
            <Route
              path="roster"
              element={<ShiftRoster />}
            />
            <Route
              path="exceptions"
              element={<Exceptions />}
            />
            <Route
              path="staff"
              element={<StaffDirectory />}
            />
            <Route path="staff/:id" element={<StaffDetail />} />
            <Route
              path="reports"
              element={<Reports />}
            />

            {/* Admin only — RLS enforces this again at the database */}
            <Route
              path="enrollment"
              element={
                <ProtectedRoute allow={['admin']}>
                  <Enrollment />
                </ProtectedRoute>
              }
            />
            <Route
              path="devices"
              element={
                <ProtectedRoute allow={['admin']}>
                  <Devices />
                </ProtectedRoute>
              }
            />
            <Route
              path="access"
              element={
                <ProtectedRoute allow={['admin']}>
                  <Access />
                </ProtectedRoute>
              }
            />
            <Route
              path="audit"
              element={
                <ProtectedRoute allow={['admin']}>
                  <AuditLog />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute allow={['admin']}>
                  <Settings />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
