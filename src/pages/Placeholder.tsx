/**
 * Shown when a signed-in user has no active console profile.
 *
 * The Placeholder component that used to live here is gone — every route now
 * has a real page.
 */

export function NoAccess() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
      <h1 className="text-xl font-semibold text-slate-900">No console access</h1>
      <p className="max-w-md text-sm text-muted">
        Your account is signed in but has no active console profile. An
        administrator needs to assign you a role before you can continue.
      </p>
    </div>
  )
}
