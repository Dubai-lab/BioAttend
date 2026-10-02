import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Loader2, RefreshCw, ScanFace } from 'lucide-react'
import {
  faceService,
  getFaceServiceUrl,
  isManualFaceService,
  isRemoteFaceService,
  setFaceServiceUrl,
} from '@/lib/face/service'
import { cn } from '@/lib/utils'

/**
 * Which face service this browser talks to.
 *
 * Normally nothing needs doing here. The PC uses its own service, and a phone
 * finds the PC through the tunnel address that run-face-tunnel.bat publishes.
 * The manual field is the fallback for when publishing is not available.
 */
export function FaceServiceAddress() {
  const [address, setAddress] = useState(() => (isManualFaceService() ? getFaceServiceUrl() : ''))
  const [online, setOnline] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The address in use is only known after a check has resolved it.
  const [current, setCurrent] = useState({ url: getFaceServiceUrl(), manual: isManualFaceService() })

  const check = useCallback(async () => {
    setChecking(true)
    setOnline(await faceService.isOnline())
    setCurrent({ url: getFaceServiceUrl(), manual: isManualFaceService() })
    setChecking(false)
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  async function save(value: string) {
    setError(null)
    if (setFaceServiceUrl(value) === null) {
      setError('That is not a usable address. Paste the https:// address from the tunnel window.')
      return
    }
    if (value.trim() === '') setAddress('')
    await check()
  }

  const where = !isRemoteFaceService()
    ? 'this computer'
    : current.manual
      ? 'address entered below'
      : 'the PC, through its tunnel'

  return (
    <section className="rounded-card border border-slate-200 bg-white p-5">
      <h2 className="flex items-center gap-2 font-medium text-slate-900">
        <ScanFace className="size-4 text-slate-400" aria-hidden="true" />
        Face service
      </h2>
      <p className="mt-1 text-sm text-muted">
        Found automatically. On a phone it reaches the PC through the tunnel opened
        by <span className="id-text">run-face-tunnel.bat</span>.
      </p>

      <div className="mt-3 flex items-start gap-2">
        <span
          className={cn(
            'mt-1.5 size-2 shrink-0 rounded-full',
            online === null ? 'bg-slate-400' : online ? 'bg-success-500' : 'bg-danger-500',
          )}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-700">
            {online === null ? 'Checking…' : online ? `Reachable — ${where}` : 'Not reachable'}
          </p>
          {isRemoteFaceService() && (
            <p className="id-text break-all text-xs text-muted">{current.url}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void check()}
          disabled={checking}
          className="flex shrink-0 items-center gap-1.5 rounded-control border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {checking ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-3.5" aria-hidden="true" />
          )}
          Check again
        </button>
      </div>

      {online === false && (
        <p className="mt-3 rounded-control bg-slate-50 px-3 py-2 text-xs text-muted">
          On the PC, start <span className="id-text">run-face-service.bat</span> and{' '}
          <span className="id-text">run-face-tunnel.bat</span>, leave both windows open,
          then press Check again.
        </p>
      )}

      <details className="mt-4" open={current.manual}>
        <summary className="cursor-pointer text-xs font-medium text-slate-600">
          Enter an address by hand
        </summary>

        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="https://….trycloudflare.com"
          aria-label="Tunnel address"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="id-text mt-2 w-full rounded-control border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
        />

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void save(address)}
            disabled={checking || address.trim() === ''}
            className="rounded-control bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save and test
          </button>
          {current.manual && (
            <button
              type="button"
              onClick={() => void save('')}
              disabled={checking}
              className="rounded-control border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Back to automatic
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-2 flex items-start gap-2 text-sm text-danger-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </details>
    </section>
  )
}
