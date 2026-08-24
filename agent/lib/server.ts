import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { resolveAsset, type AgentConfig } from './config.js'
import { compose } from './compose.js'
import { runPipeline } from './pipeline.js'
import { Printer, PrintError, windowsPrinterTransport, type Transport } from './printer.js'
import { buildStatus, probeShare, type StatusReport } from './status.js'

/**
 * The agent's HTTP surface — PHOTO_MODULE.md §6.
 *
 * Two endpoints, no framework. A dependency that parses HTTP is a dependency
 * that can be compromised, and this process holds guests' photographs in memory
 * on a machine in a café. node:http is enough for two routes.
 *
 * THE RULES THIS FILE ENFORCES, and they are not stylistic:
 *
 *  - Binds 127.0.0.1 and only 127.0.0.1. Never 0.0.0.0. A café's network has
 *    guests on it; a print endpoint reachable from the wifi is a stranger
 *    printing whatever they like on your roll.
 *  - Nothing touches disk. No temp files, no upload directory, no debug dump.
 *    The image exists as a Buffer, becomes a raster, goes down the wire, and the
 *    buffers are zeroed. Rule 2 is that the photo has no path off the device,
 *    and a temp file is a path.
 *  - Logs carry events, never payloads. No base64, no caption text, no image
 *    bytes — a log file is a file, and a photo in it is a photo on disk.
 */

export const AGENT_VERSION = '1.0.0'

/** Big enough for a 1920×1080 JPEG at quality 90, and not much more. */
const MAX_BODY_BYTES = 8 * 1024 * 1024

export type PrintRequest = {
  jpegBase64: string
  caption: string
  dateLabel: string
  copies: number
  /** Admin-configured printer, validated. Undefined = use the local config. */
  share: string | undefined
}

/**
 * Does this look like a printer, rather than a file somebody wants written?
 *
 * The share can now come from admin settings, which means it arrives over HTTP
 * from a browser. That is fine for choosing a printer and not fine as a general
 * "write these bytes here" instruction: without this check, anybody who could
 * reach the admin could have the agent overwrite a file on the kiosk PC.
 *
 * Accepted: a UNC share (two backslashes, host, one backslash, share name) or a
 * legacy device name such as LPT1 or USB001. Rejected: drive letters, relative
 * paths, anything containing "..", and anything overlong.
 */
export function isPrinterTarget(value: string): boolean {
  if (value.length === 0 || value.length > 128) return false
  if (value.includes('..')) return false

  // \\host\share — the two leading backslashes are what make it a share rather
  // than a path, and neither segment may contain a separator or a wildcard.
  const UNC = /^\\\\[^\\/:*?"<>|]+\\[^\\/:*?"<>|]+$/
  if (UNC.test(value)) return true

  return /^(LPT[1-9]|COM[1-9]|USB[0-9]{3})$/i.test(value)
}

export type ServerOptions = {
  config: AgentConfig
  /** Defaults to the Windows share from config. Injectable for tests. */
  transport?: Transport
  /** The exact origin the kiosk is served from. No wildcards. */
  allowedOrigin: string
  log?: (event: Record<string, unknown>) => void
}

/** One line of JSON per event. Never a payload. */
function defaultLog(event: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`)
}

/**
 * Overwrite a buffer before letting it go.
 *
 * V8 will free it eventually, but "eventually" leaves the guest's face sitting
 * in a heap page for as long as the allocator feels like it, and a crash dump
 * from that process would contain it. Zeroing is cheap and makes the promise
 * true at the moment the print finishes rather than whenever GC runs.
 */
function zero(...buffers: (Uint8Array | undefined)[]): void {
  for (const buffer of buffers) buffer?.fill(0)
}

function json(res: ServerResponse, status: number, body: unknown, origin: string): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'cache-control': 'no-store',
    // The kiosk is the only caller; nothing here should ever be framed or sniffed.
    'x-content-type-options': 'nosniff',
  })
  res.end(payload)
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let total = 0

  for await (const chunk of req) {
    total += (chunk as Buffer).length
    if (total > MAX_BODY_BYTES) {
      // Destroy rather than drain: a runaway body should cost nothing.
      req.destroy()
      throw new Error('body too large')
    }
    chunks.push(chunk as Buffer)
  }

  return Buffer.concat(chunks).toString('utf8')
}

function parsePrintRequest(raw: string): PrintRequest {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('body is not JSON')
  }

  if (typeof parsed !== 'object' || parsed === null) throw new Error('body must be an object')
  const body = parsed as Record<string, unknown>

  const jpegBase64 = body['jpegBase64']
  if (typeof jpegBase64 !== 'string' || jpegBase64 === '') {
    throw new Error('jpegBase64 is required')
  }

  const copies = body['copies']
  if (copies !== undefined && (typeof copies !== 'number' || !Number.isInteger(copies))) {
    throw new Error('copies must be a whole number')
  }
  // Capped: a bug in the kiosk asking for 500 copies must not empty the roll.
  const resolvedCopies = Math.min(Math.max(1, (copies as number) ?? 1), 3)

  // An invalid share is DROPPED, not rejected: the print should still happen on
  // the locally configured printer. Refusing the whole job would cost a guest
  // their keepsake over a settings typo.
  const rawShare = body['share']
  const share =
    typeof rawShare === 'string' && isPrinterTarget(rawShare.trim())
      ? rawShare.trim()
      : undefined

  return {
    jpegBase64,
    caption: typeof body['caption'] === 'string' ? body['caption'] : '',
    dateLabel: typeof body['dateLabel'] === 'string' ? body['dateLabel'] : '',
    copies: resolvedCopies,
    share,
  }
}

export function createAgentServer(options: ServerOptions): Server {
  const { config, allowedOrigin } = options
  const log = options.log ?? defaultLog
  const transport = options.transport ?? windowsPrinterTransport(config.print.share)
  const printer = new Printer(transport)

  const status = async (): Promise<StatusReport> => {
    // Nothing to probe when a transport was injected — that is a test or a
    // calibration run, and it is reachable by definition.
    if (options.transport) return buildStatus(AGENT_VERSION, true, null)
    const probe = await probeShare(config.print.share)
    return buildStatus(AGENT_VERSION, probe.reachable, null, probe.detail)
  }

  return createServer((req, res) => {
    void handle(req, res).catch((error: unknown) => {
      log({ event: 'unhandled', message: error instanceof Error ? error.message : 'unknown' })
      if (!res.headersSent) json(res, 500, { ok: false, reason: 'INTERNAL' }, allowedOrigin)
    })
  })

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const origin = req.headers.origin

    // Exactly one origin, compared literally. A wildcard here would let any page
    // the kiosk browser visits drive the printer.
    if (origin !== undefined && origin !== allowedOrigin) {
      log({ event: 'origin_rejected', origin })
      json(res, 403, { ok: false, reason: 'FORBIDDEN' }, allowedOrigin)
      return
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': allowedOrigin,
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '86400',
      })
      res.end()
      return
    }

    const url = req.url ?? '/'

    if (req.method === 'GET' && url.startsWith('/status')) {
      json(res, 200, await status(), allowedOrigin)
      return
    }

    if (req.method === 'POST' && url.startsWith('/print')) {
      await handlePrint(req, res)
      return
    }

    json(res, 404, { ok: false, reason: 'NOT_FOUND' }, allowedOrigin)
  }

  async function handlePrint(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startedAt = process.hrtime.bigint()

    let jpeg: Buffer | undefined
    let composed: Uint8Array | undefined

    try {
      const request = parsePrintRequest(await readBody(req))

      jpeg = Buffer.from(request.jpegBase64, 'base64')
      if (jpeg.length === 0) throw new Error('jpegBase64 did not decode to anything')

      const photo = await runPipeline(jpeg, config.pipeline)

      const print = await compose({
        photo: photo.bitmap,
        caption: request.caption,
        footer: request.dateLabel,
        logoPath: resolveAsset(config.print.logo),
        fontPath: resolveAsset(config.print.font),
        rasterWidth: config.print.rasterWidth,
      })
      composed = print.pixels

      // A per-request printer when admin named one, otherwise the shared
      // single-flight instance. Both still serialise: the request handler is
      // awaited, so two prints cannot overlap on one connection.
      const target =
        request.share && request.share !== config.print.share
          ? new Printer(windowsPrinterTransport(request.share))
          : printer

      let bytes = 0
      for (let copy = 0; copy < request.copies; copy += 1) {
        const result = await target.print(print)
        bytes += result.bytes
      }

      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6
      // Dimensions and timings only. No caption, no base64, no pixels.
      log({
        event: 'printed',
        ms: Math.round(ms),
        bytes,
        copies: request.copies,
        // Whether the target came from admin or from the local file. Not the
        // path itself — a share name is machine detail, not print telemetry.
        target: request.share ? 'configured' : 'local',
      })
      json(res, 200, { ok: true, ms: Math.round(ms) }, allowedOrigin)
    } catch (error) {
      if (error instanceof PrintError) {
        log({ event: 'print_failed', reason: error.reason })
        json(res, 200, { ok: false, reason: error.reason }, allowedOrigin)
        return
      }

      const message = error instanceof Error ? error.message : 'unknown'
      log({ event: 'print_rejected', message })
      // 400, not 500: a malformed request is the caller's problem, and the kiosk
      // treats any non-ok the same way — silently on to thank-you (§7).
      json(res, 400, { ok: false, reason: 'BAD_REQUEST' }, allowedOrigin)
    } finally {
      // Always, on every path. The guest's face does not outlive the request.
      zero(jpeg, composed)
    }
  }
}

/**
 * Bind loopback only.
 *
 * The host argument is not optional and is not configurable. Making it a setting
 * would mean somebody could set it to 0.0.0.0 to "test from my laptop" and
 * leave it that way.
 */
export function listen(server: Server, port = 9100): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
}
