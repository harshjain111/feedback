import { readdir, readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { parseConfig } from '../lib/config.js'
import { createAgentServer, listen } from '../lib/server.js'
import { PrintError, type Transport } from '../lib/printer.js'
import rawConfig from '../config.json' with { type: 'json' }

const ORIGIN = 'https://feedback.allindiacafe.in'
const CONFIG = parseConfig(rawConfig)

let server: Server
let base: string
let logs: Record<string, unknown>[]
let sent: Uint8Array[]
let scratch: string

/** Captures the job instead of writing it anywhere. */
function captureTransport(): Transport {
  return {
    name: 'capture',
    async write(bytes) {
      sent.push(bytes.slice())
    },
  }
}

async function start(transport: Transport = captureTransport()): Promise<void> {
  logs = []
  sent = []
  server = createAgentServer({
    config: CONFIG,
    transport,
    allowedOrigin: ORIGIN,
    log: (event) => logs.push(event),
  })
  await listen(server, 0)
  const address = server.address() as AddressInfo
  base = `http://127.0.0.1:${address.port}`
}

async function stop(): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()))
}

/** A small real JPEG, since the pipeline actually decodes it. */
async function jpegBase64(width = 480, height = 360): Promise<string> {
  const pixels = Buffer.allocUnsafe(width * height * 3)
  for (let i = 0; i < pixels.length; i += 3) {
    const v = 80 + ((i / 3) % 90)
    pixels[i] = v
    pixels[i + 1] = v
    pixels[i + 2] = v
  }
  const buffer = await sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 85 })
    .toBuffer()
  return buffer.toString('base64')
}

beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), 'aic-agent-'))
  await start()
})

afterEach(async () => {
  await stop()
  await rm(scratch, { recursive: true, force: true })
})

describe('binding', () => {
  it('listens on loopback and nowhere else', async () => {
    // §6. A café's network has guests on it. A print endpoint reachable from the
    // wifi is a stranger printing whatever they like on your roll.
    const address = server.address() as AddressInfo
    expect(address.address).toBe('127.0.0.1')
    expect(address.address).not.toBe('0.0.0.0')
    expect(address.address).not.toBe('::')
  })
})

describe('GET /status', () => {
  it('answers the §6 shape', async () => {
    const body = await (await fetch(`${base}/status`, { headers: { origin: ORIGIN } })).json()
    expect(body).toMatchObject({
      ok: expect.any(Boolean),
      printer: expect.any(String),
      paper: expect.any(String),
      camera: expect.any(String),
      version: expect.any(String),
    })
  })

  it('says the camera is unknown rather than guessing', async () => {
    // The agent cannot see the camera; only the browser can. A green badge on a
    // dead camera is worse than an honest "unknown" the kiosk fills in itself.
    const body = await (await fetch(`${base}/status`, { headers: { origin: ORIGIN } })).json()
    expect(body.camera).toBe('unknown')
  })

  it('does not claim paper is fine when nothing checked it', async () => {
    // A spooler share is write-only, so DLE EOT cannot round-trip. Reporting
    // "ok" here would make the admin badge actively misleading; out-of-paper is
    // caught by prints failing and §8b layer 2 disabling the module.
    const body = await (await fetch(`${base}/status`, { headers: { origin: ORIGIN } })).json()
    expect(body.paper).toBe('unknown')
  })
})

describe('POST /print', () => {
  it('prints and reports how long it took', async () => {
    const response = await fetch(`${base}/print`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({
        jpegBase64: await jpegBase64(),
        caption: 'Some memories are meant to be carried home.',
        dateLabel: 'All India Café · 24 Aug 2026',
      }),
    })

    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.ms).toBeGreaterThanOrEqual(0)
    expect(sent).toHaveLength(1)
    // A real ESC/POS job: reset, then a raster command.
    expect(Array.from(sent[0]!.subarray(0, 2))).toEqual([0x1b, 0x40])
  })

  it('caps copies, so a kiosk bug cannot empty the roll', async () => {
    await fetch(`${base}/print`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ jpegBase64: await jpegBase64(), copies: 500 }),
    })
    expect(sent.length).toBeLessThanOrEqual(3)
  })

  it('returns a typed reason instead of throwing when the printer is down', async () => {
    await stop()
    await start({
      name: 'dead',
      write: async () => {
        throw new PrintError('OUT_OF_PAPER', 'roll is empty')
      },
    })

    const response = await fetch(`${base}/print`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ jpegBase64: await jpegBase64() }),
    })

    // 200 with ok:false, not a 5xx. §7 — the kiosk treats every non-ok the same
    // way, silently onward to thank-you. A guest never sees an error about a
    // free gift.
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: false, reason: 'OUT_OF_PAPER' })
  })

  it('rejects a body that is not a print request', async () => {
    for (const body of ['not json', '{}', '{"jpegBase64":""}', '[]']) {
      const response = await fetch(`${base}/print`, {
        method: 'POST',
        headers: { origin: ORIGIN, 'content-type': 'application/json' },
        body,
      })
      expect(response.status, body).toBe(400)
      expect((await response.json()).ok, body).toBe(false)
    }
  })

  it('rejects base64 that is not an image', async () => {
    const response = await fetch(`${base}/print`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ jpegBase64: Buffer.from('hello').toString('base64') }),
    })
    expect(response.status).toBe(400)
  })
})

describe('the CORS check', () => {
  it('refuses an origin that is not the kiosk', async () => {
    // A wildcard here would let any page the kiosk browser visits drive the
    // printer.
    const response = await fetch(`${base}/status`, {
      headers: { origin: 'https://evil.example' },
    })
    expect(response.status).toBe(403)
    expect(logs.some((l) => l['event'] === 'origin_rejected')).toBe(true)
  })

  it('never answers with a wildcard origin', async () => {
    const response = await fetch(`${base}/status`, { headers: { origin: ORIGIN } })
    expect(response.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(response.headers.get('access-control-allow-origin')).not.toBe('*')
  })

  it('answers preflight for the kiosk only', async () => {
    const ok = await fetch(`${base}/print`, { method: 'OPTIONS', headers: { origin: ORIGIN } })
    expect(ok.status).toBe(204)

    const bad = await fetch(`${base}/print`, {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example' },
    })
    expect(bad.status).toBe(403)
  })
})

describe('rule 2 — the photo has no path off the device', () => {
  it('writes nothing to disk during a print', async () => {
    // The load-bearing test of this file. A temp file IS a path off the device,
    // and "we delete it afterwards" is a promise a café cannot audit.
    const before = await readdir(scratch)
    expect(before).toEqual([])

    const cwdBefore = new Set(await readdir(process.cwd()))

    await fetch(`${base}/print`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ jpegBase64: await jpegBase64(), caption: 'x', dateLabel: 'y' }),
    })

    expect(await readdir(scratch)).toEqual([])
    const cwdAfter = await readdir(process.cwd())
    expect(cwdAfter.filter((name) => !cwdBefore.has(name))).toEqual([])
  })

  it('logs events, never payloads', async () => {
    const base64 = await jpegBase64()
    const caption = 'A caption that must never appear in a log file'

    await fetch(`${base}/print`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ jpegBase64: base64, caption, dateLabel: 'z' }),
    })

    const dumped = JSON.stringify(logs)
    // A log file is a file. A photo in it is a photo on disk.
    expect(dumped).not.toContain(base64.slice(0, 64))
    expect(dumped).not.toContain(caption)
    expect(logs.some((l) => l['event'] === 'printed')).toBe(true)
  })

  it('refuses a body big enough to be an attack', async () => {
    const huge = 'A'.repeat(9 * 1024 * 1024)
    const response = await fetch(`${base}/print`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ jpegBase64: huge }),
    }).catch(() => null)

    // Either rejected outright or the socket was destroyed mid-body. Both are
    // correct; what must not happen is 9MB being buffered and processed.
    if (response) expect(response.ok).toBe(false)
  })
})

describe('unknown routes', () => {
  it('404s anything that is not /status or /print', async () => {
    const response = await fetch(`${base}/admin`, { headers: { origin: ORIGIN } })
    expect(response.status).toBe(404)
  })
})

describe('the ESC/POS job the kiosk would actually get', () => {
  it('is a complete, cuttable job', async () => {
    await fetch(`${base}/print`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({
        jpegBase64: await jpegBase64(),
        caption: 'Some memories are meant to be carried home.',
        dateLabel: 'All India Café · 24 Aug 2026',
      }),
    })

    const job = sent[0]!
    expect(Array.from(job.subarray(0, 2))).toEqual([0x1b, 0x40]) // reset
    expect(Array.from(job.subarray(job.length - 4))).toEqual([0x1d, 0x56, 66, 4]) // cut
    expect(job.length).toBeGreaterThan(10_000)
  })
})

describe('config on disk', () => {
  it('is the same file the server reads', async () => {
    // Guards against the config drifting out of the shipped file — the tests
    // parse config.json directly, so a change there must keep parsing.
    const onDisk = JSON.parse(await readFile(new URL('../config.json', import.meta.url), 'utf8'))
    expect(() => parseConfig(onDisk)).not.toThrow()
  })
})
