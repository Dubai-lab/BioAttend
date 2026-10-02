import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { supabase } from '@/lib/supabase'
import { useServiceStatus } from '@/lib/use-service-status'
import { Sidebar } from './Sidebar'

export function ConsoleLayout() {
  const status = useServiceStatus()
  const [badges, setBadges] = useState<Record<string, number>>({})
  const [menuOpen, setMenuOpen] = useState(false)

  // Counts shown against nav items. Refreshed on a timer rather than
  // subscribed to — a badge being 30 seconds stale costs nothing, and a live
  // subscription per nav item does.
  useEffect(() => {
    let active = true

    async function loadBadges() {
      const today = new Date().toISOString().slice(0, 10)

      const [live, exceptions] = await Promise.all([
        supabase.from('attendance').select('id').eq('shift_date', today),
        supabase.from('attendance').select('id').eq('requires_approval', true),
      ])

      if (!active) return
      setBadges({
        '/live': live.data?.length ?? 0,
        '/exceptions': exceptions.data?.length ?? 0,
      })
    }

    void loadBadges()
    const timer = setInterval(() => void loadBadges(), 30000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  // dvh rather than vh: on a phone the address bar comes and goes, and 100vh
  // is the height WITHOUT it — the bottom of the page would sit under it.
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-50 lg:flex-row">
      {/* Phones and tablets only: the sidebar is a drawer there, and this bar
          is what opens it. */}
      <header className="flex shrink-0 items-center gap-3 bg-shell-900 px-3 py-2.5 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="rounded-control p-2 text-slate-200 hover:bg-shell-800"
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <Logo tone="light" size="sm" />
      </header>

      <Sidebar
        badges={badges}
        serviceOnline={status.online ?? undefined}
        faceOnline={status.faceOnline ?? undefined}
        readersReachable={status.readersReachable}
        lastSyncAt={status.lastSync ?? undefined}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      {/* min-w-0 lets wide tables scroll inside their own card instead of
          stretching the whole page sideways. */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
