import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { useAuth } from '@/lib/auth-context'
import { navGroupsForRole } from '@/lib/navigation'
import { cn, initials } from '@/lib/utils'

interface SidebarProps {
  /** Live count badges, keyed by route. e.g. { '/live': 142 } */
  badges?: Record<string, number>
  /** Undefined while the first health check is still in flight. */
  serviceOnline?: boolean
  readersReachable?: string
  lastSyncAt?: string
}

export function Sidebar({
  badges = {},
  // Deliberately no default: `undefined` is the "still checking" state, and a
  // default of false would report a working service as offline for the first
  // second of every page load.
  serviceOnline,
  readersReachable,
  lastSyncAt,
}: SidebarProps) {
  const { profile, signOut } = useAuth()
  const groups = navGroupsForRole(profile?.role)

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-shell-900 text-slate-300">
      {/* Brand */}
      <div className="px-4 py-5">
        <Logo tone="light" size="sm" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {groups.map((group) => (
          <div key={group.heading} className="mb-5">
            <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {group.heading}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const badge = badges[item.to]
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-control px-3 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-brand-600 font-medium text-white'
                            : 'text-slate-300 hover:bg-shell-800 hover:text-white',
                        )
                      }
                    >
                      <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                      <span className="flex-1">{item.label}</span>
                      {badge !== undefined && badge > 0 && (
                        <span className="id-text rounded-full bg-shell-800 px-2 py-0.5 text-[11px] text-slate-300">
                          {badge}
                        </span>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Biometric service status — operators need this visible at all times */}
      <div className="mx-3 mb-3 rounded-card bg-shell-950 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'size-2 rounded-full',
              serviceOnline === undefined
                ? 'bg-slate-500'
                : serviceOnline
                  ? 'bg-success-500'
                  : 'bg-danger-500',
            )}
            aria-hidden="true"
          />
          <p className="text-xs font-medium text-white">
            Biometric service{' '}
            {serviceOnline === undefined ? 'checking…' : serviceOnline ? 'online' : 'offline'}
          </p>
        </div>
        {readersReachable && (
          <p className="mt-1 pl-4 text-[11px] text-slate-400">
            {readersReachable} readers reachable
          </p>
        )}
        {lastSyncAt && (
          <p className="pl-4 text-[11px] text-slate-400">Last sync {lastSyncAt}</p>
        )}
        {serviceOnline === false && (
          <p className="mt-1 pl-4 text-[11px] leading-snug text-slate-500">
            Start <span className="id-text">run-bridge.bat</span> on the station with
            the reader.
          </p>
        )}
      </div>

      {/* Signed-in user */}
      <div className="flex items-center gap-3 border-t border-shell-800 px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-medium text-white">
          {initials(profile?.full_name ?? '')}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm text-white">{profile?.full_name}</p>
          <p className="truncate text-[11px] capitalize text-slate-400">
            {profile?.role === 'admin' ? 'HR Administrator' : 'Supervisor'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-control p-1.5 text-slate-400 transition-colors hover:bg-shell-800 hover:text-white"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  )
}
