import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useServiceStatus } from '@/lib/use-service-status'
import { Sidebar } from './Sidebar'

export function ConsoleLayout() {
  const status = useServiceStatus()
  const [badges, setBadges] = useState<Record<string, number>>({})

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

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar
        badges={badges}
        serviceOnline={status.online ?? undefined}
        faceOnline={status.faceOnline ?? undefined}
        readersReachable={status.readersReachable}
        lastSyncAt={status.lastSync ?? undefined}
      />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
