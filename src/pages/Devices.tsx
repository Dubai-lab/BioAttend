import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Fingerprint,
  Loader2,
  Plug,
  PlugZap,
  ServerCrash,
} from 'lucide-react'
import {
  BridgeOfflineError,
  bridge,
  type DeviceStatus,
  type EnrollResult,
  type EnrollStage,
} from '@/lib/fingerprint/bridge'
import { ReaderSync } from '@/components/devices/ReaderSync'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'busy' | 'error'

export function Devices() {
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null)
  const [device, setDevice] = useState<DeviceStatus | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [result, setResult] = useState<EnrollResult | null>(null)
  const [stage, setStage] = useState<EnrollStage | null>(null)

  const checkBridge = useCallback(async () => {
    const online = await bridge.isOnline()
    setBridgeOnline(online)
    if (!online) setDevice(null)
  }, [])

  useEffect(() => {
    void checkBridge()
    // Paused during a capture: the person is at the sensor and a health poll
    // competing for the device only gets in the way.
    if (status === 'busy') return
    const timer = setInterval(() => void checkBridge(), 10000)
    return () => clearInterval(timer)
  }, [checkBridge, status])

  function report(err: unknown) {
    if (err instanceof BridgeOfflineError) {
      setOffline(true)
      setBridgeOnline(false)
      setError(err.message)
      setDevice(null)
    } else {
      setOffline(false)
      const message = err instanceof Error ? err.message : String(err)
      setError(message)

      // "Device is not open" means the reader was dropped mid-operation —
      // usually a bridge restart. Reflect that in the UI so the Connect
      // button reappears, instead of showing a connected device that isn't.
      if (message.includes('not open')) setDevice(null)
    }
    setStatus('error')
  }

  async function handleConnect() {
    setStatus('busy')
    setError(null)
    try {
      setDevice(await bridge.connect())
      setStatus('idle')
    } catch (err) {
      report(err)
    }
  }

  async function handleDisconnect() {
    try {
      await bridge.disconnect()
    } catch {
      /* already gone */
    }
    setDevice(null)
    setResult(null)
    setStatus('idle')
    setError(null)
  }

  async function handleEnrollTest() {
    setStatus('busy')
    setError(null)
    setResult(null)
    setStage(null)
    try {
      setResult(await bridge.enrollStepwise(3, setStage))
      setStatus('idle')
    } catch (err) {
      report(err)
    } finally {
      setStage(null)
    }
  }

  return (
    <div className="px-8 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Devices</h1>
        <p className="mt-1 text-sm text-muted">Readers and kiosks</p>
      </header>

      {bridgeOnline === false && (
        <Callout tone="danger" icon={ServerCrash} title="Fingerprint bridge is not running" className="mb-6">
          The reader is a USB mass-storage device, so the browser cannot reach it
          directly. Start <span className="id-text">bridge/run-bridge.bat</span> and
          leave that window open.
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-card border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-medium text-slate-900">Fingerprint reader</h2>
                <p className="mt-1 text-sm text-muted">
                  Connected through the local bridge. Close{' '}
                  <span className="id-text">fpdemo.exe</span> — only one program can
                  hold the reader.
                </p>
              </div>
              <button
                type="button"
                onClick={() => (device ? void handleDisconnect() : void handleConnect())}
                disabled={status === 'busy' || bridgeOnline === false}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-control px-4 py-2 text-sm font-medium transition-colors',
                  device
                    ? 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    : 'bg-brand-600 text-white hover:bg-brand-700',
                  (status === 'busy' || bridgeOnline === false) &&
                    'cursor-not-allowed opacity-60',
                )}
              >
                {status === 'busy' ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : device ? (
                  <PlugZap className="size-4" aria-hidden="true" />
                ) : (
                  <Plug className="size-4" aria-hidden="true" />
                )}
                {device ? 'Disconnect' : 'Connect reader'}
              </button>
            </div>

            {error && !offline && (
              <Callout tone="danger" icon={AlertCircle} title="Reader error" className="mt-4">
                {error}
              </Callout>
            )}
          </section>

          {device && (
            <section className="rounded-card border border-slate-200 bg-white p-5">
              <h2 className="font-medium text-slate-900">Enrollment test</h2>
              <p className="mt-1 text-sm text-muted">
                Three presses of the same finger, merged into one template. Nothing is
                saved — this only proves the reader works end to end.
              </p>

              <button
                type="button"
                onClick={() => void handleEnrollTest()}
                disabled={status === 'busy'}
                className="mt-4 flex items-center gap-2 rounded-control bg-brand-600 px-4 py-2
                           text-sm font-medium text-white transition-colors hover:bg-brand-700
                           disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === 'busy' ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Fingerprint className="size-4" aria-hidden="true" />
                )}
                Capture a test fingerprint
              </button>

              {stage && <CaptureProgress stage={stage} />}

              {result && (
                <div className="mt-4 space-y-3">
                  <Callout tone="success" icon={CheckCircle2} title="Template captured">
                    The reader produced a valid template and returned it to the browser.
                  </Callout>

                  <dl className="grid grid-cols-3 gap-3">
                    <Stat label="Template size" value={`${result.bytes} bytes`} />
                    <Stat label="Quality" value={`${result.quality}`} />
                    <Stat label="Base64 length" value={`${result.template.length}`} />
                  </dl>

                  <details className="rounded-control border border-slate-200 bg-slate-50 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">
                      Show base64 template
                    </summary>
                    <p className="id-text mt-2 break-all text-xs text-slate-600">
                      {result.template}
                    </p>
                  </details>
                </div>
              )}
            </section>
          )}

          <ReaderSync deviceConnected={device !== null} />
        </div>

        <aside className="space-y-4">
          <section className="rounded-card border border-slate-200 bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 font-medium text-slate-900">
              <Cpu className="size-4 text-slate-400" aria-hidden="true" />
              Device
            </h2>

            <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-3">
              <span
                className={cn(
                  'size-2 rounded-full',
                  bridgeOnline ? 'bg-success-500' : 'bg-danger-500',
                )}
                aria-hidden="true"
              />
              <p className="text-sm text-slate-700">
                Bridge {bridgeOnline === null ? 'checking…' : bridgeOnline ? 'online' : 'offline'}
              </p>
            </div>

            {!device && <p className="text-sm text-muted">Reader not connected.</p>}

            {device && (
              <dl className="space-y-2 text-sm">
                <Row label="Enrolled" value={`${device.templateCount}`} />
                <Row label="Transport" value={`USB disk (type ${device.deviceType})`} />
                <Row label="Module" value={shortVersion(device.version)} />
              </dl>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

/**
 * Live capture feedback.
 *
 * The person is looking at their finger, not the screen, so the instruction
 * has to be large and the state unmistakable at a glance: which press they
 * are on, and whether to press or lift.
 */
function CaptureProgress({ stage }: { stage: EnrollStage }) {
  const instruction: Record<EnrollStage['kind'], string> = {
    waiting: `Place your finger on the sensor — scan ${stage.pass} of ${stage.of}`,
    captured: `Scan ${stage.pass} of ${stage.of} captured`,
    lift: 'Lift your finger, then place the same finger again',
    merging: 'Combining scans into one template…',
    done: 'Done',
  }

  const isLift = stage.kind === 'lift'

  return (
    <div
      className={cn(
        'mt-4 rounded-control px-4 py-4 transition-colors',
        isLift ? 'bg-warn-50' : 'bg-brand-50',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <Fingerprint
          className={cn(
            'size-6 shrink-0',
            stage.kind === 'waiting' ? 'animate-pulse text-brand-600' : 'text-brand-700',
            isLift && 'text-warn-700',
          )}
          aria-hidden="true"
        />
        <p
          className={cn(
            'text-sm font-medium',
            isLift ? 'text-warn-700' : 'text-brand-800',
          )}
        >
          {instruction[stage.kind]}
        </p>
      </div>

      {/* One dot per scan — completed, current, pending */}
      <div className="mt-3 flex items-center gap-2 pl-9">
        {Array.from({ length: stage.of }, (_, index) => {
          const number = index + 1
          const complete =
            number < stage.pass ||
            (number === stage.pass && stage.kind !== 'waiting') ||
            stage.kind === 'merging' ||
            stage.kind === 'done'
          const current = number === stage.pass && stage.kind === 'waiting'

          return (
            <span
              key={number}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                complete ? 'bg-brand-600' : current ? 'bg-brand-300' : 'bg-slate-200',
              )}
            />
          )
        })}
      </div>
    </div>
  )
}

/** The info page is mostly binary; keep only the readable product string. */
function shortVersion(raw: string): string {
  const match = raw.match(/Ver\s*[\d.]+\s*\w*/i)
  return match ? match[0].trim() : raw.slice(0, 24) || '—'
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="id-text text-slate-900">{value}</dd>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="id-text mt-0.5 text-sm text-slate-900">{value}</dd>
    </div>
  )
}

function Callout({
  tone,
  icon: Icon,
  title,
  children,
  className,
}: {
  tone: 'danger' | 'success'
  icon: typeof AlertCircle
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      className={cn(
        'flex items-start gap-2.5 rounded-control border px-4 py-3 text-sm',
        tone === 'danger'
          ? 'border-danger-500/20 bg-danger-50 text-danger-700'
          : 'border-success-500/20 bg-success-50 text-success-700',
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 opacity-90">{children}</p>
      </div>
    </div>
  )
}
