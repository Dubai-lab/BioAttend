/**
 * Client for the local fingerprint bridge.
 *
 * The reader enumerates as USB mass storage, so no browser API can reach it.
 * A small Python service on the same PC owns the device and exposes it over
 * HTTP; see bridge/README.md.
 *
 *   Browser ──HTTP──▶ 127.0.0.1:8321 ──ctypes──▶ fpsapit.dll ──SCSI──▶ Reader
 *
 * The bridge captures fingerprints. It has no authority over attendance —
 * that stays in Supabase, behind the kiosk credential and the shift windows.
 */

const BRIDGE_URL = 'http://127.0.0.1:8321'

export class BridgeOfflineError extends Error {
  constructor() {
    super(
      'The fingerprint bridge is not running. Start it with bridge/run-bridge.bat ' +
        'and leave the window open.',
    )
    this.name = 'BridgeOfflineError'
  }
}

export class ReaderError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message)
    this.name = 'ReaderError'
  }
}

interface BridgeErrorBody {
  error?: string
  code?: number
  timeout?: boolean
}

async function call<T>(path: string, body?: unknown, timeoutMs = 60000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(`${BRIDGE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    })
  } catch {
    // A connection refused here means the service is not running. Distinguish
    // it, because "bridge offline" and "reader unplugged" need different fixes.
    throw new BridgeOfflineError()
  } finally {
    clearTimeout(timer)
  }

  const payload = (await response.json()) as T & BridgeErrorBody

  if (!response.ok) {
    throw new ReaderError(payload.error ?? `Bridge returned ${response.status}`)
  }
  // Device-level failures come back as HTTP 200 with an error field, so the
  // caller can tell "no finger" from "service unreachable".
  if (payload.error) {
    throw new ReaderError(payload.error, payload.code)
  }

  return payload
}

export interface BridgeHealth {
  ok: boolean
  service: string
  connected: boolean
  deviceType: number | null
}

export interface DeviceStatus {
  connected: boolean
  deviceType: number
  diskNumber: number
  templateCount: number
  version: string
}

export interface EnrollResult {
  /** Base64 of the 512-byte template — store this in Supabase verbatim. */
  template: string
  bytes: number
  quality: number
}

/** Where a stepwise enrollment has got to, for display at the sensor. */
export interface EnrollStage {
  kind: 'waiting' | 'captured' | 'lift' | 'merging' | 'done'
  pass: number
  of: number
}

export interface IdentifyResult {
  matched: boolean
  /** Flash slot; map through reader_slots to a staff member. */
  slot?: number
  /** Higher is better. Apply a threshold before trusting it. */
  score?: number
}

export const bridge = {
  /** Is the service up? Short timeout — this is a liveness check. */
  async health(): Promise<BridgeHealth> {
    return call<BridgeHealth>('/health', undefined, 3000)
  },

  async isOnline(): Promise<boolean> {
    try {
      const status = await bridge.health()
      return status.ok
    } catch {
      return false
    }
  },

  async connect(): Promise<DeviceStatus> {
    return call<DeviceStatus>('/connect', {}, 15000)
  },

  async disconnect(): Promise<void> {
    await call('/disconnect')
  },

  /**
   * Three presses of one finger, merged into a single template.
   *
   * Blocks until finished, so the UI can show nothing in between. Prefer
   * enrollStepwise() for anything a person is watching.
   */
  async enroll(passes = 3): Promise<EnrollResult> {
    return call<EnrollResult>('/enroll', { passes }, 120000)
  },

  /** Wait for one press and extract features into the given buffer. */
  async capturePass(buffer: 1 | 2, timeoutSec = 20): Promise<void> {
    await call('/capture', { buffer, timeout: timeoutSec }, (timeoutSec + 5) * 1000)
  },

  /** Block until the sensor reads clear, so the next press is a fresh one. */
  async waitForRemoval(timeoutSec = 15): Promise<void> {
    await call('/wait-removal', { timeout: timeoutSec }, (timeoutSec + 5) * 1000)
  },

  /** Merge the captured passes and return the finished template. */
  async merge(): Promise<EnrollResult> {
    return call<EnrollResult>('/merge', {}, 20000)
  },

  /**
   * Enrollment driven one press at a time so the UI can report progress.
   *
   * Someone standing at the sensor needs to know which press they are on and
   * when to lift. A single blocking call cannot tell them.
   */
  async enrollStepwise(
    passes: number,
    onProgress: (stage: EnrollStage) => void,
  ): Promise<EnrollResult> {
    for (let pass = 1; pass <= passes; pass++) {
      onProgress({ kind: 'waiting', pass, of: passes })
      await bridge.capturePass(pass === 1 ? 1 : 2)
      onProgress({ kind: 'captured', pass, of: passes })

      if (pass < passes) {
        onProgress({ kind: 'lift', pass, of: passes })
        await bridge.waitForRemoval()
      }
    }

    onProgress({ kind: 'merging', pass: passes, of: passes })
    const result = await bridge.merge()
    onProgress({ kind: 'done', pass: passes, of: passes })
    return result
  },

  /** Capture once and search the on-device library. */
  async identify(pageCount = 1000): Promise<IdentifyResult> {
    return call<IdentifyResult>('/identify', { pageCount }, 30000)
  },

  async templateCount(): Promise<number> {
    const result = await call<{ count: number }>('/template-count')
    return result.count
  },

  /** Wipe the module's flash and rewrite it from Supabase. */
  async sync(templates: { slot: number; template: string }[]): Promise<{ synced: number }> {
    return call<{ synced: number }>('/sync', { templates }, 300000)
  },
}
