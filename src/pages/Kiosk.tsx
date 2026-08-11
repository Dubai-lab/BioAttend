import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Fingerprint,
  Loader2,
  ScanFace,
  ServerCrash,
  XCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { bridge, BridgeOfflineError } from '@/lib/fingerprint/bridge'
import { staffForSlot } from '@/lib/fingerprint/sync'
import { Logo } from '@/components/brand/Logo'
import {
  describeFaceFailure,
  identifyByFace,
  needsStaffNumber,
  scanForFace,
  verifyFaceByStaffNumber,
  type FaceScanProgress,
} from '@/lib/face/kiosk-face'
import { StaffNumberEntry } from '@/components/kiosk/StaffNumberEntry'
import { MyRecord, type MyRecordData } from '@/components/kiosk/MyRecord'
import { cn } from '@/lib/utils'
import type { AttendanceVerdict } from '@/types/database'

const STORAGE_KEY = 'bioattend.kiosk.credentials'
const RESULT_DISPLAY_MS = 5000

/**
 * Minimum match score to accept an identification.
 *
 * The module already applies its own security level (3) before reporting a
 * match at all, so this is a second floor rather than the primary gate. It is
 * deliberately low until real scores have been observed — set it too high and
 * valid staff are turned away, which is the failure people notice.
 *
 * Tune it from the confidence values logged on every attendance row.
 */
const MIN_MATCH_SCORE = 1

interface KioskCredentials {
  code: string
  token: string
  readerId: string
}

type Screen =
  | { state: 'idle' }
  | { state: 'scanning' }
  | { state: 'result'; verdict: AttendanceVerdict }
  /** `detail` is diagnostic text shown only while tuning; blank in normal use. */
  | { state: 'unknown'; detail?: string }
  /** Fingerprint failed; asking who they are before the camera confirms it. */
  | { state: 'enter_number' }
  | { state: 'face'; message: string; progress?: FaceScanProgress }
  | { state: 'error'; message: string }
  /** Staff member viewing their own record after identifying themselves. */
  | { state: 'my_record'; data: MyRecordData }

export function Kiosk() {
  const [credentials, setCredentials] = useState<KioskCredentials | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as KioskCredentials) : null
  })
  const [screen, setScreen] = useState<Screen>({ state: 'idle' })
  const [now, setNow] = useState(new Date())
  const [staffNumber, setStaffNumber] = useState('')
  // Tracks whether the fingerprint reader is usable, so the idle screen can
  // tell people what to actually do rather than pointing at a dead sensor.
  const [fingerprintAvailable, setFingerprintAvailable] = useState(true)
  // The scan loop must not restart while someone is typing. A ref rather than
  // state so the running loop sees the change without being torn down.
  const awaitingInput = useRef(false)
  // What the next successful identification should do. A lookup uses exactly
  // the same identification path as a check-in — the only difference is what
  // happens once the person is known, so there is no second, weaker way in.
  const intent = useRef<'check_in' | 'lookup'>('check_in')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // The camera runs continuously but is only *read* after a fingerprint
  // fails. Starting it on demand would cost several seconds while someone
  // stands waiting; a permanently warm stream costs nothing.
  useEffect(() => {
    if (!credentials) return
    let cancelled = false

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch {
        // No camera is survivable — fingerprint still works, face fallback
        // simply will not be offered.
        console.warn('[kiosk] no camera available; face fallback disabled')
      }
    }

    void startCamera()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [credentials])

  /** Show a staff member their own recent attendance. */
  const showRecord = useCallback(async (creds: KioskCredentials, staffId: string) => {
    const { data, error } = await supabase.rpc('staff_attendance_lookup', {
      p_kiosk_code: creds.code,
      p_kiosk_token: creds.token,
      p_staff_id: staffId,
      p_days: 30,
    })

    intent.current = 'check_in'

    if (error) {
      setScreen({ state: 'error', message: error.message })
      return
    }

    const result = data as { ok: boolean; reason?: string } & MyRecordData
    if (!result?.ok) {
      setScreen({ state: 'unknown' })
      return
    }

    awaitingInput.current = true // hold the scan loop while they read
    setScreen({ state: 'my_record', data: result })
  }, [])

  /** Write the attendance row and show the verdict. Shared by both methods. */
  const record = useCallback(
    async (
      creds: KioskCredentials,
      staffId: string,
      method: 'fingerprint' | 'face',
      confidence: number | null,
    ) => {
      if (intent.current === 'lookup') {
        await showRecord(creds, staffId)
        return
      }

      const { data, error } = await supabase.rpc('record_attendance', {
        p_kiosk_code: creds.code,
        p_kiosk_token: creds.token,
        p_staff_id: staffId,
        p_method: method,
        p_confidence: confidence,
      })

      if (error) {
        setScreen({ state: 'error', message: error.message })
        return
      }

      setScreen({ state: 'result', verdict: data as AttendanceVerdict })
    },
    [showRecord],
  )

  /**
   * Fast fallback: identify by face alone. No typing.
   *
   * Falls through to the keypad only when the database says it cannot safely
   * name anyone — a weak match, or two people scoring close together. That
   * refusal is the safeguard; the earlier sibling false accept happened
   * because only one face was enrolled, so there was no runner-up to compare
   * against and the margin rule never ran.
   */
  const tryFaceIdentify = useCallback(
    async (creds: KioskCredentials) => {
      const video = videoRef.current
      if (!video || !streamRef.current) {
        awaitingInput.current = true
        setScreen({ state: 'enter_number' })
        return
      }

      setScreen({ state: 'face', message: 'Look at the camera' })

      try {
        const scan = await scanForFace(video, {
          timeoutMs: 7000,
          onProgress: (progress) =>
            setScreen({ state: 'face', message: progress.message, progress }),
        })

        if (!scan.ok) {
          if (scan.reason === 'spoof') {
            setScreen({ state: 'unknown', detail: 'A photo or screen cannot be used' })
            return
          }
          awaitingInput.current = true
          setScreen({ state: 'enter_number' })
          return
        }

        const result = await identifyByFace(creds.code, creds.token, scan.embedding)
        console.info('[kiosk] face identify', result)

        if (result.matched && result.staff_id) {
          await record(
            creds,
            result.staff_id,
            'face',
            result.similarity ? Math.round(result.similarity * 100) : null,
          )
          return
        }

        if (needsStaffNumber(result)) {
          awaitingInput.current = true
          setScreen({ state: 'enter_number' })
          return
        }

        setScreen({ state: 'unknown' })
      } catch (err) {
        console.warn('[kiosk] face identify failed:', err)
        awaitingInput.current = true
        setScreen({ state: 'enter_number' })
      }
    },
    [record],
  )

  /**
   * Secondary fallback: the person states who they are, then face confirms it.
   *
   * Automatic 1:N face identification was removed after it produced a false
   * accept in testing — a sibling matched an enrolled face at 0.69-0.80
   * against a 0.62 threshold, and no threshold separated them. Asking "is
   * this David?" instead of "who is this?" is a far easier question and does
   * not degrade as the roster grows.
   */
  const verifyByNumber = useCallback(
    async (creds: KioskCredentials, number: string) => {
      const video = videoRef.current
      if (!video || !streamRef.current) {
        setScreen({ state: 'unknown', detail: 'No camera on this station' })
        return
      }

      setScreen({ state: 'face', message: 'Look at the camera' })

      try {
        const scan = await scanForFace(video, {
          timeoutMs: 8000,
          onProgress: (progress) =>
            setScreen({ state: 'face', message: progress.message, progress }),
        })

        if (!scan.ok) {
          setScreen({
            state: 'unknown',
            detail:
              scan.reason === 'spoof' ? 'A photo or screen cannot be used' : undefined,
          })
          return
        }

        const result = await verifyFaceByStaffNumber(
          creds.code,
          creds.token,
          number,
          scan.embedding,
        )
        console.info('[kiosk] face verify', result)

        if (!result.ok || !result.staff_id) {
          setScreen({ state: 'unknown', detail: describeFaceFailure(result) })
          return
        }

        await record(
          creds,
          result.staff_id,
          'face',
          result.similarity ? Math.round(result.similarity * 100) : null,
        )
      } catch (err) {
        console.warn('[kiosk] face verification failed:', err)
        setScreen({ state: 'unknown' })
      } finally {
        setStaffNumber('')
        awaitingInput.current = false
      }
    },
    [record],
  )

  /**
   * One scan cycle: wait for a finger, identify, record, display.
   *
   * The loop restarts itself so the station is always live — nobody should
   * have to click anything to clock in.
   */
  const cycle = useCallback(async (creds: KioskCredentials) => {
    setScreen({ state: 'scanning' })

    try {
      const match = await bridge.identify()
      setFingerprintAvailable(true)

      if (!match.matched || match.slot === undefined) {
        console.info('[kiosk] no fingerprint match — trying face')
        await tryFaceIdentify(creds)
        return
      }

      console.info('[kiosk] match: slot', match.slot, 'score', match.score)

      if ((match.score ?? 0) < MIN_MATCH_SCORE) {
        // A weak match is a rejection, never a guess.
        console.info('[kiosk] fingerprint match too weak — trying face')
        await tryFaceIdentify(creds)
        return
      }

      const staffId = await staffForSlot(creds.readerId, match.slot)
      if (!staffId) {
        setScreen({
          state: 'error',
          message: 'This reader is out of sync. Ask an administrator to re-sync it.',
        })
        return
      }

      await record(creds, staffId, 'fingerprint', match.score ?? null)
    } catch (err) {
      // The fingerprint service being down must not take the station down with
      // it. A reader that fails at 6am should leave face check-in working, not
      // strand a whole shift — the entire point of a second modality is that
      // one failing does not stop the other.
      if (err instanceof BridgeOfflineError) {
        setFingerprintAvailable(false)
        if (streamRef.current) {
          console.info('[kiosk] fingerprint service unavailable — face only')
          await tryFaceIdentify(creds)
          return
        }
        // Neither modality is available. Now it is genuinely out of service.
        setScreen({
          state: 'error',
          message: 'Neither the fingerprint reader nor a camera is available.',
        })
        return
      }

      const message = err instanceof Error ? err.message : String(err)

      // Nobody came to the sensor. Not an error — go back to waiting.
      if (message.toLowerCase().includes('timed out')) {
        setScreen({ state: 'idle' })
        return
      }

      // A device-level complaint — smudged sensor, poor press, empty buffer.
      // Ask the person to try again rather than declaring the kiosk broken;
      // a station that says "Out of service" over one bad press is a station
      // nobody trusts.
      // Raw device codes mean nothing to the person at the sensor. Log the
      // detail for whoever maintains the system; show them an instruction.
      console.warn('[kiosk] scan failed:', message)
      setScreen({ state: 'unknown' })
    }
  }, [])

  // Continuous loop. Results linger briefly, then the station clears itself
  // so the next person never sees the previous person's name.
  useEffect(() => {
    if (!credentials) return
    let cancelled = false

    async function loop() {
      while (!cancelled) {
        await cycle(credentials!)
        if (cancelled) break

        // Hold while the keypad is up — restarting the fingerprint scan
        // underneath someone who is typing would wipe their entry.
        while (awaitingInput.current && !cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
        if (cancelled) break

        // Let the result linger, then clear so the next person never sees the
        // previous person's name.
        await new Promise((resolve) => setTimeout(resolve, RESULT_DISPLAY_MS))
      }
    }

    void loop()
    return () => {
      cancelled = true
    }
  }, [credentials, cycle])

  if (!credentials) {
    return <KioskSetup onSave={setCredentials} />
  }

  return (
    <div className="kiosk-root px-6">
      <div className="absolute right-8 top-6 text-right">
        <p className="id-text text-3xl font-semibold text-white">{format(now, 'HH:mm')}</p>
        <p className="text-sm text-slate-400">{format(now, 'EEEE d MMMM yyyy')}</p>
      </div>

      <div className="absolute left-8 top-6">
        <Logo tone="light" size="sm" />
      </div>

      {/*
        The preview is shown only while the camera is being used, never at
        idle. A permanent mirror at a check-in station invites people to
        linger, but hiding it entirely leaves someone with no way to tell
        whether they are in shot — which is worse. Every comparable system
        (phone face unlock, airport gates) shows framing feedback.
      */}
      <div
        className={cn(
          'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity',
          screen.state === 'face' ? 'z-10 opacity-100' : 'pointer-events-none opacity-0',
        )}
        style={{ marginTop: screen.state === 'face' ? '-40px' : 0 }}
      >
        <div
          className={cn(
            'relative size-72 overflow-hidden rounded-full border-4 transition-colors',
            screen.state === 'face' && screen.progress?.detected
              ? 'border-success-500'
              : 'border-slate-600',
          )}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            className="size-full -scale-x-100 object-cover"
          />
        </div>

        {/* Progress pips: one per frame required before the face is accepted. */}
        {screen.state === 'face' && screen.progress && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {Array.from({ length: screen.progress.required }, (_, index) => (
              <span
                key={index}
                className={cn(
                  'size-2.5 rounded-full transition-colors',
                  index < screen.progress!.streak ? 'bg-success-500' : 'bg-slate-600',
                )}
              />
            ))}
          </div>
        )}
      </div>

      {screen.state === 'my_record' ? (
        <MyRecord
          data={screen.data}
          onClose={() => {
            awaitingInput.current = false
            setScreen({ state: 'idle' })
          }}
        />
      ) : screen.state === 'enter_number' ? (
        <StaffNumberEntry
          value={staffNumber}
          onChange={setStaffNumber}
          onSubmit={() => void verifyByNumber(credentials, staffNumber)}
          onCancel={() => {
            setStaffNumber('')
            awaitingInput.current = false
            setScreen({ state: 'idle' })
          }}
        />
      ) : (
        <ScreenBody screen={screen} fingerprintAvailable={fingerprintAvailable} />
      )}

      {/* Offered only at idle. Pressing it does not bypass anything — the next
          scan identifies the person exactly as a check-in would, and only then
          shows their record instead of recording attendance. */}
      {screen.state === 'idle' && (
        <button
          type="button"
          onClick={() => {
            intent.current = 'lookup'
            setScreen({ state: 'scanning' })
          }}
          className="absolute bottom-16 rounded-card border border-slate-700 px-6 py-3 text-base text-slate-300 transition-colors hover:bg-shell-900"
        >
          View my attendance record
        </button>
      )}

      {/* Hidden while the keypad or a record is up: it is absolutely
          positioned and would otherwise overlap their controls. */}
      {screen.state !== 'enter_number' && screen.state !== 'my_record' && (
        <p className="absolute bottom-6 text-xs text-slate-600">
          {credentials.code}
          {fingerprintAvailable
            ? ' · Place your finger on the reader'
            : ' · Face check-in'}
        </p>
      )}
    </div>
  )
}

function ScreenBody({
  screen,
  fingerprintAvailable,
}: {
  screen: Screen
  fingerprintAvailable: boolean
}) {
  if (screen.state === 'idle' || screen.state === 'scanning') {
    // With the reader unavailable the station still works by face, so it
    // prompts for that instead of pointing at a sensor that will not respond.
    if (!fingerprintAvailable) {
      return (
        <div className="flex flex-col items-center gap-8">
          <div className="flex size-40 items-center justify-center rounded-full border-4 border-slate-700">
            <ScanFace className="size-20 text-info-500" aria-hidden="true" />
          </div>
          <p className="kiosk-headline text-white">Look at the camera</p>
          <p className="kiosk-subhead">
            The fingerprint reader is unavailable — check in by face
          </p>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center gap-8">
        <div
          className={cn(
            'flex size-40 items-center justify-center rounded-full border-4',
            screen.state === 'scanning'
              ? 'animate-pulse border-brand-400 bg-brand-500/10'
              : 'border-slate-700',
          )}
        >
          <Fingerprint className="size-20 text-brand-400" aria-hidden="true" />
        </div>
        <p className="kiosk-headline text-white">Place your finger</p>
        <p className="kiosk-subhead">Hold it flat on the reader until it beeps</p>
      </div>
    )
  }

  if (screen.state === 'enter_number' || screen.state === 'my_record') return null

  if (screen.state === 'face') {
    return (
      <div className="flex flex-col items-center gap-8">
        <div className="flex size-40 animate-pulse items-center justify-center rounded-full border-4 border-info-500 bg-info-500/10">
          <ScanFace className="size-20 text-info-500" aria-hidden="true" />
        </div>
        <p className="kiosk-headline text-white">{screen.message}</p>
        <p className="kiosk-subhead">Fingerprint did not read — checking your face</p>
      </div>
    )
  }

  if (screen.state === 'unknown') {
    return (
      <Outcome
        icon={XCircle}
        tone="warn"
        headline="Not recognised"
        detail={screen.detail ?? 'Try again, or see your supervisor if this keeps happening'}
      />
    )
  }

  if (screen.state === 'error') {
    return (
      <Outcome
        icon={ServerCrash}
        tone="danger"
        headline="Out of service"
        detail={screen.message}
      />
    )
  }

  const { verdict } = screen

  if (verdict.decision === 'check_in' || verdict.decision === 'check_out') {
    const isIn = verdict.decision === 'check_in'
    const flagged =
      verdict.status === 'late' ||
      verdict.status === 'late_unapproved' ||
      verdict.status === 'unscheduled' ||
      verdict.status === 'early'

    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div
          className={cn(
            'flex size-28 items-center justify-center rounded-full',
            flagged ? 'bg-warn-500/15' : 'bg-success-500/15',
          )}
        >
          <CheckCircle2
            className={cn('size-16', flagged ? 'text-warn-500' : 'text-success-500')}
            aria-hidden="true"
          />
        </div>

        <div>
          <p
            className={cn(
              'text-2xl font-medium uppercase tracking-wide',
              flagged ? 'text-warn-500' : 'text-success-500',
            )}
          >
            {isIn ? 'Checked in' : 'Checked out'}
          </p>
          <p className="kiosk-headline mt-2 text-white">{verdict.staff_name}</p>
          <p className="id-text mt-2 text-lg text-slate-400">{verdict.staff_no}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 text-lg text-slate-300">
          {verdict.shift && <span>{verdict.shift}</span>}
          {verdict.at && (
            <span className="id-text flex items-center gap-2">
              <Clock className="size-5" aria-hidden="true" />
              {format(new Date(verdict.at), 'HH:mm')}
            </span>
          )}
        </div>

        {flagged && (
          <p className="flex items-center gap-2 rounded-full bg-warn-500/15 px-5 py-2 text-base text-warn-500">
            <AlertTriangle className="size-5" aria-hidden="true" />
            {statusMessage(verdict.status)}
          </p>
        )}
      </div>
    )
  }

  if (verdict.decision === 'duplicate') {
    return (
      <Outcome
        icon={CheckCircle2}
        tone="info"
        headline={verdict.staff_name ?? 'Already recorded'}
        detail="You have already checked in and out today"
      />
    )
  }

  // Rejected
  return (
    <Outcome
      icon={XCircle}
      tone="warn"
      headline={rejectionHeadline(verdict.reason)}
      detail={rejectionDetail(verdict)}
    />
  )
}

function Outcome({
  icon: Icon,
  tone,
  headline,
  detail,
}: {
  icon: typeof XCircle
  tone: 'warn' | 'danger' | 'info'
  headline: string
  detail: string
}) {
  const colours = {
    warn: 'text-warn-500 bg-warn-500/15',
    danger: 'text-danger-500 bg-danger-500/15',
    info: 'text-info-500 bg-info-500/15',
  }[tone]

  const [text, background] = colours.split(' ')

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className={cn('flex size-28 items-center justify-center rounded-full', background)}>
        <Icon className={cn('size-16', text)} aria-hidden="true" />
      </div>
      <p className="kiosk-headline text-white">{headline}</p>
      <p className="kiosk-subhead max-w-2xl">{detail}</p>
    </div>
  )
}

function statusMessage(status: AttendanceVerdict['status']): string {
  switch (status) {
    case 'late':
      return 'Late arrival — recorded'
    case 'late_unapproved':
      return 'Late — needs supervisor approval'
    case 'unscheduled':
      return 'No shift rostered — flagged for your supervisor'
    case 'early':
      return 'Early departure — needs supervisor approval'
    default:
      return ''
  }
}

function rejectionHeadline(reason?: string): string {
  switch (reason) {
    case 'too_early':
      return 'Too early'
    case 'window_closed':
      return 'Not yet'
    case 'inactive_staff':
      return 'Account inactive'
    case 'invalid_kiosk':
      return 'Station not authorised'
    default:
      return 'Not recorded'
  }
}

function rejectionDetail(verdict: AttendanceVerdict): string {
  if (verdict.reason === 'too_early' && verdict.opens_at) {
    return `Check-in opens at ${format(new Date(verdict.opens_at), 'HH:mm')}`
  }
  if (verdict.reason === 'window_closed' && verdict.checkout_opens_at) {
    return `Check-out opens at ${format(new Date(verdict.checkout_opens_at), 'HH:mm')}`
  }
  if (verdict.reason === 'inactive_staff') {
    return 'Speak to HR'
  }
  if (verdict.reason === 'invalid_kiosk') {
    return 'This station needs to be registered by an administrator'
  }
  return 'Speak to your supervisor'
}

/**
 * One-time setup per physical station.
 *
 * The credentials identify the STATION, not a person — that is what stops
 * someone marking themselves present from a laptop at home.
 */
function KioskSetup({ onSave }: { onSave: (creds: KioskCredentials) => void }) {
  const [code, setCode] = useState('KIOSK-MAIN-01')
  const [token, setToken] = useState('')
  const [readerId, setReaderId] = useState('HR-DESK-01')

  function save() {
    const creds = { code: code.trim(), token: token.trim(), readerId: readerId.trim() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds))
    onSave(creds)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-shell-950 px-6">
      <div className="w-full max-w-md rounded-card bg-shell-900 p-8">
        <h1 className="text-lg font-semibold text-white">Set up this station</h1>
        <p className="mt-1 text-sm text-slate-400">
          Entered once per kiosk PC. These identify the station itself — staff never
          sign in.
        </p>

        <div className="mt-6 space-y-4">
          <Labelled label="Kiosk code">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="id-text w-full rounded-control bg-shell-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </Labelled>

          <Labelled label="Kiosk token">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="From register_kiosk.sql"
              className="w-full rounded-control bg-shell-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </Labelled>

          <Labelled label="Reader attached to this station">
            <input
              value={readerId}
              onChange={(e) => setReaderId(e.target.value)}
              className="id-text w-full rounded-control bg-shell-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </Labelled>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={!code.trim() || !token.trim() || !readerId.trim()}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-control bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Loader2 className="hidden size-4 animate-spin" aria-hidden="true" />
          Start station
        </button>
      </div>
    </div>
  )
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-300">{label}</span>
      {children}
    </label>
  )
}
