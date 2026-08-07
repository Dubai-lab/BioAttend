import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Database, Loader2, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { syncReader, type SyncProgress } from '@/lib/fingerprint/sync'
import { cn } from '@/lib/utils'
import type { Reader } from '@/types/database'

const DEFAULT_READER_ID = 'HR-DESK-01'

/**
 * Push templates from Supabase into the reader's flash.
 *
 * Until this runs, the module's library is empty and identification finds
 * nobody — enrolment alone is not enough.
 */
export function ReaderSync({ deviceConnected }: { deviceConnected: boolean }) {
  const [reader, setReader] = useState<Reader | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void supabase
      .from('readers')
      .select('*')
      .order('created_at')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setReader(data)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function registerReader() {
    setBusy(true)
    setError(null)
    const { data, error: insertError } = await supabase
      .from('readers')
      .insert({
        id: DEFAULT_READER_ID,
        label: 'HR desk reader',
        location: 'HR office',
        firmware: 'Ver 1.34 LIROX',
        capacity: 1000,
      })
      .select()
      .single()

    if (insertError) setError(insertError.message)
    else setReader(data)
    setBusy(false)
  }

  async function runSync() {
    if (!reader) return
    setBusy(true)
    setError(null)
    setSummary(null)
    setProgress(null)

    try {
      const result = await syncReader(reader.id, setProgress)
      setSummary(
        `${result.templates} templates for ${result.staff} staff written to the reader.`,
      )
      const { data } = await supabase
        .from('readers')
        .select('*')
        .eq('id', reader.id)
        .maybeSingle()
      if (data) setReader(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  if (loading) return null

  return (
    <section className="rounded-card border border-slate-200 bg-white p-5">
      <h2 className="flex items-center gap-2 font-medium text-slate-900">
        <Database className="size-4 text-slate-400" aria-hidden="true" />
        Template sync
      </h2>
      <p className="mt-1 text-sm text-muted">
        Templates live in Supabase. The reader keeps a copy in flash so it can
        match without the network. Sync after enrolling or removing staff.
      </p>

      {!reader ? (
        <>
          <p className="mt-4 text-sm text-slate-700">
            No reader is registered yet. Register this one to enable syncing.
          </p>
          <button
            type="button"
            onClick={() => void registerReader()}
            disabled={busy}
            className="mt-3 rounded-control bg-brand-600 px-4 py-2 text-sm font-medium text-white
                       hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Register reader <span className="id-text">{DEFAULT_READER_ID}</span>
          </button>
        </>
      ) : (
        <>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Reader" value={reader.id} mono />
            <Row label="Location" value={reader.location ?? '—'} />
            <Row
              label="Last synced"
              value={
                reader.last_synced_at
                  ? new Date(reader.last_synced_at).toLocaleString()
                  : 'Never'
              }
            />
          </dl>

          <button
            type="button"
            onClick={() => void runSync()}
            disabled={busy || !deviceConnected}
            className="mt-4 flex items-center gap-2 rounded-control bg-brand-600 px-4 py-2
                       text-sm font-medium text-white hover:bg-brand-700
                       disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            {busy ? 'Syncing…' : 'Sync templates to reader'}
          </button>

          {!deviceConnected && (
            <p className="mt-2 text-xs text-muted">Connect the reader first.</p>
          )}

          {!reader.last_synced_at && deviceConnected && (
            <p className="mt-2 text-xs text-warn-700">
              This reader has never been synced — identification will find nobody
              until it is.
            </p>
          )}

          {progress && <ProgressPanel progress={progress} />}
        </>
      )}

      {summary && (
        <div className="mt-4 flex items-start gap-2.5 rounded-control border border-success-500/20 bg-success-50 px-4 py-3 text-sm text-success-700">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{summary}</p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-control border border-danger-500/20 bg-danger-50 px-4 py-3 text-sm text-danger-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}
    </section>
  )
}

function ProgressPanel({ progress }: { progress: SyncProgress }) {
  const labels: Record<SyncProgress['phase'], string> = {
    loading: 'Loading templates from Supabase…',
    wiping: 'Clearing the reader’s existing library…',
    writing: 'Writing templates to the reader…',
    mapping: 'Saving the slot map…',
    done: 'Complete',
  }

  const pct =
    progress.total && progress.written !== undefined
      ? Math.round((progress.written / progress.total) * 100)
      : null

  return (
    <div className="mt-4 rounded-control bg-brand-50 px-4 py-3" role="status" aria-live="polite">
      <p className="text-sm font-medium text-brand-800">{labels[progress.phase]}</p>
      {pct !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-100">
          <div
            className={cn('h-full rounded-full bg-brand-600 transition-all')}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={cn('text-slate-900', mono && 'id-text')}>{value}</dd>
    </div>
  )
}
