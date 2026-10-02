import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, ScanFace } from 'lucide-react'
import {
  faceService,
  getFaceServiceUrl,
  isRemoteFaceService,
  setFaceServiceUrl,
} from '@/lib/face/service'
import { cn } from '@/lib/utils'

/**
 * Which face service this browser talks to.
 *
 * The PC running the service needs nothing here. A phone does: it has no
 * service of its own, so it is given the public address of a tunnel to the PC.
 * The setting is kept in this browser only, which is why it must be entered on
 * the phone itself rather than once for everybody.
 */
export function FaceServiceAddress() {
  const [address, setAddress] = useState(() => (isRemoteFaceService() ? getFaceServiceUrl() : ''))
  const [remote, setRemote] = useState(isRemoteFaceService)
  const [online, setOnline] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const check = useCallback(async () => {
    setChecking(true)
    setOnline(await faceService.isOnline())
    setChecking(false)
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  async function save(value: string) {
    setError(null)
    const stored = setFaceServiceUrl(value)
    if (stored === null) {
      setError('That is not a usable address. Paste the https:// address from the tunnel window.')
      return
    }
    setRemote(isRemoteFaceService())
    setAddress(isRemoteFaceService() ? stored : '')
    await check()
  }

  return (
    <section className="rounded-card border border-slate-200 bg-white p-5">
      <h2 className="flex items-center gap-2 font-medium text-slate-900">
        <ScanFace className="size-4 text-slate-400" aria-hidden="true" />
        Face service
      </h2>
      <p className="mt-1 text-sm text-muted">
        On the PC that runs the face service, leave this empty. On a phone, paste
        the address shown by <span className="id-text">run-face-tunnel.bat</span> so
        this device can reach that PC.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <span
          className={cn(
            'size-2 shrink-0 rounded-full',
            online === null ? 'bg-slate-400' : online ? 'bg-success-500' : 'bg-danger-500',
          )}
          aria-hidden="true"
        />
        <p className="min-w-0 text-sm text-slate-700">
          {online === null ? 'Checking…' : online ? 'Reachable' : 'Not reachable'}
          {' · '}
          <span className="id-text break-all text-xs text-muted">
            {remote ? getFaceServiceUrl() : 'this computer'}
          </span>
        </p>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">Tunnel address</span>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="https://….trycloudflare.com"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="id-text w-full rounded-control border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save(address)}
          disabled={checking || address.trim() === ''}
          className="flex items-center gap-2 rounded-control bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {checking && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Save and test
        </button>
        {remote && (
          <button
            type="button"
            onClick={() => void save('')}
            disabled={checking}
            className="rounded-control border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Use this computer
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-danger-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {remote && online && (
        <p className="mt-3 flex items-start gap-2 text-sm text-success-700">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This device will send face captures to the PC through the tunnel.
        </p>
      )}

      {remote && online === false && (
        <p className="mt-3 text-xs text-muted">
          A free tunnel gets a new address each time it starts. If it was
          restarted, paste the new one.
        </p>
      )}
    </section>
  )
}
