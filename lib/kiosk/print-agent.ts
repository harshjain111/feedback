/**
 * Talking to the print agent on the kiosk itself.
 *
 * The agent listens on 127.0.0.1:9100 and nowhere else, so this only ever works
 * on the kiosk PC. Everywhere else — a developer's laptop, a preview
 * deployment, a phone someone opened the URL on — the fetch simply fails, and
 * that failure is a supported state rather than an error: §7 says any failure
 * routes silently to thank-you.
 *
 * The photo goes browser memory -> here -> loopback -> printer. It never
 * reaches Vercel, never reaches Supabase, never touches disk. This module is the
 * only place in the whole app that handles image bytes, and it hands them
 * straight to localhost.
 */

const AGENT_ORIGIN = 'http://127.0.0.1:9100'

/** Long enough for a 900-row raster, short enough not to strand a guest. */
const PRINT_TIMEOUT_MS = 25_000
const STATUS_TIMEOUT_MS = 2_000

export type AgentStatus = {
  ok: boolean
  printer: string
  paper: string
  camera: string
  version: string
}

export type PrintResult =
  | { ok: true; ms: number }
  | { ok: false; reason: string }

async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await run(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Ask the agent how it is. Null when it cannot be reached at all.
 *
 * Short timeout on purpose: this runs on the kiosk's heartbeat and must not
 * hold anything up. A missing agent is a fast null, not a two-second stall.
 */
export async function getAgentStatus(): Promise<AgentStatus | null> {
  try {
    return await withTimeout(async (signal) => {
      const response = await fetch(`${AGENT_ORIGIN}/status`, { signal, cache: 'no-store' })
      if (!response.ok) return null
      return (await response.json()) as AgentStatus
    }, STATUS_TIMEOUT_MS)
  } catch {
    return null
  }
}

/**
 * Send one print.
 *
 * Never throws. Every failure — agent down, out of paper, timeout, a laptop
 * with no agent at all — comes back as `{ ok: false, reason }`, because the
 * caller's only correct response to any of them is the same: carry on to
 * thank-you without saying anything (§7).
 */
export async function sendPrint(job: {
  jpegBase64: string
  caption: string
  dateLabel: string
}): Promise<PrintResult> {
  try {
    return await withTimeout(async (signal) => {
      const response = await fetch(`${AGENT_ORIGIN}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...job, copies: 1 }),
        signal,
      })

      if (!response.ok) return { ok: false, reason: `HTTP_${response.status}` }
      return (await response.json()) as PrintResult
    }, PRINT_TIMEOUT_MS)
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return { ok: false, reason: aborted ? 'TIMEOUT' : 'UNREACHABLE' }
  }
}

/** "24 Aug 2026" in the café's own timezone, for the footer (§5). */
export function kioskDateLabel(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(now)
}
