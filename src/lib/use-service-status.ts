import { useCallback, useEffect, useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { bridge } from '@/lib/fingerprint/bridge'

export interface ServiceStatus {
  /** Is the local fingerprint bridge answering? */
  online: boolean | null
  /** e.g. "1 / 1" — readers registered and reachable. */
  readersReachable: string
  /** Human phrase for the most recent reader sync, or null if never. */
  lastSync: string | null
}

const POLL_MS = 15000

/**
 * Status of the biometric plumbing, for the sidebar.
 *
 * "Reachable" means the bridge is answering, not that each reader has been
 * probed individually — the bridge owns one reader at a time. With several
 * stations this would need per-kiosk heartbeats; for now it reports honestly
 * on the one it can see.
 */
export function useServiceStatus(): ServiceStatus {
  const [online, setOnline] = useState<boolean | null>(null)
  const [readerCount, setReaderCount] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  const check = useCallback(async () => {
    setOnline(await bridge.isOnline())
  }, [])

  useEffect(() => {
    void check()
    const timer = setInterval(() => void check(), POLL_MS)
    return () => clearInterval(timer)
  }, [check])

  useEffect(() => {
    let active = true

    void supabase
      .from('readers')
      .select('id, last_synced_at')
      .eq('is_active', true)
      .then(({ data }) => {
        if (!active || !data) return
        setReaderCount(data.length)

        const latest = data
          .map((row) => row.last_synced_at)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1)

        setLastSyncedAt(latest ?? null)
      })

    return () => {
      active = false
    }
  }, [])

  return {
    online,
    // A reader is only usable if the bridge that drives it is running, so a
    // registered reader with the service down counts as unreachable.
    readersReachable: `${online ? readerCount : 0} / ${readerCount}`,
    lastSync: lastSyncedAt
      ? `${formatDistanceToNowStrict(new Date(lastSyncedAt))} ago`
      : null,
  }
}
