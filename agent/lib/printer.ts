import { createWriteStream } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import type { Bitmap1Bit } from './dither.js'
import { buildJob } from './escpos.js'

/**
 * Getting the bytes to the printer.
 *
 * Deliberately thin, and deliberately behind an interface. Everything that can
 * be decided without hardware — what to send, how to band it, what a status byte
 * means — lives in escpos.ts and is tested byte-for-byte. What is left here is
 * the one thing that genuinely cannot be verified until the kiosk exists: a
 * write to a USB endpoint.
 *
 * So the transport is swappable. `file` writes the job somewhere for inspection
 * and is what the tests and `pnpm print:test` use; `windows` writes to a printer
 * share, which is how a USB ESC/POS device is reached on Windows without a
 * native USB binding. If the real device turns out to want something else, one
 * function changes and nothing above it moves.
 */

export type PrintFailure =
  | 'OUT_OF_PAPER'
  | 'COVER_OPEN'
  | 'OFFLINE'
  | 'BUSY'
  | 'TIMEOUT'
  | 'TRANSPORT'

export class PrintError extends Error {
  constructor(
    readonly reason: PrintFailure,
    message: string,
    /**
     * The underlying throwable. Passed to Error's own `cause` too, so a bare
     * console.error still shows it, but kept as a named field because callers
     * switch on `reason` and want the original alongside it.
     */
    readonly underlying?: unknown,
  ) {
    super(message, underlying === undefined ? undefined : { cause: underlying })
    this.name = 'PrintError'
  }
}

export type Transport = {
  readonly name: string
  /** Resolves once the bytes are handed off. Rejects with a PrintError. */
  write(bytes: Uint8Array): Promise<void>
}

/**
 * Writes the job to a file. Not a stub — this is how calibration works before
 * the printer is on the desk, and how the tests assert a real job end to end.
 */
export function fileTransport(path: string): Transport {
  return {
    name: `file:${path}`,
    async write(bytes) {
      try {
        await writeFile(path, bytes)
      } catch (cause) {
        throw new PrintError('TRANSPORT', `could not write ${path}`, cause)
      }
    },
  }
}

/**
 * Windows: write raw bytes to a shared printer.
 *
 * A USB ESC/POS printer on Windows is reached through the spooler. Share the
 * printer locally (`net share`, or Printer Properties → Sharing) and its UNC
 * path becomes writable — `\\localhost\AIC-Thermal`. The driver must be set to
 * pass data through unmodified ("Generic / Text Only", or the vendor's raw
 * mode), or the spooler will helpfully reformat the raster into confetti.
 *
 * The alternative is a native USB binding (libusb via node-usb), which needs a
 * WinUSB driver swap that then stops the vendor's own utilities working. The
 * share is less elegant and survives a printer replacement.
 *
 * UNVERIFIED AGAINST HARDWARE. This is the one function in the agent that the
 * kiosk has to prove.
 */
export function windowsPrinterTransport(share: string): Transport {
  return {
    name: `windows:${share}`,
    async write(bytes) {
      try {
        await pipeline(Readable.from(Buffer.from(bytes)), createWriteStream(share))
      } catch (cause) {
        const code = (cause as NodeJS.ErrnoException).code
        // ENOENT: the share does not exist or the printer is not shared.
        // EBUSY / EACCES: another job holds it, or permissions are wrong.
        if (code === 'ENOENT') {
          throw new PrintError('OFFLINE', `printer share ${share} was not found`, cause)
        }
        if (code === 'EBUSY' || code === 'EACCES') {
          throw new PrintError('BUSY', `printer share ${share} is busy or not permitted`, cause)
        }
        throw new PrintError('TRANSPORT', `writing to ${share} failed`, cause)
      }
    },
  }
}

/**
 * One job at a time.
 *
 * §6 requires a single-flight queue. Two prints interleaved on one ESC/POS
 * connection do not produce two prints — they produce one corrupt raster, and
 * the guest gets a strip of noise. The kiosk should never issue concurrent
 * prints, but "should never" is not a guarantee worth betting a keepsake on.
 */
export class Printer {
  #busy = false

  constructor(
    private readonly transport: Transport,
    private readonly timeoutMs = 20_000,
  ) {}

  get busy(): boolean {
    return this.#busy
  }

  async print(bitmap: Bitmap1Bit): Promise<{ ms: number; bytes: number }> {
    if (this.#busy) {
      throw new PrintError('BUSY', 'a print is already in progress')
    }

    this.#busy = true
    const startedAt = process.hrtime.bigint()

    try {
      const job = buildJob(bitmap)

      let timer: NodeJS.Timeout | undefined
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new PrintError('TIMEOUT', `no response after ${this.timeoutMs}ms`)),
          this.timeoutMs,
        )
      })

      try {
        await Promise.race([this.transport.write(job), timeout])
      } finally {
        if (timer) clearTimeout(timer)
      }

      return {
        ms: Number(process.hrtime.bigint() - startedAt) / 1e6,
        bytes: job.length,
      }
    } finally {
      // Released even on failure. A jam that left this set would take the module
      // down until someone restarted the service, turning one bad print into an
      // evening of them.
      this.#busy = false
    }
  }
}

/** Human-readable reason, for the admin device-health badge (§6). */
export const FAILURE_LABELS: Record<PrintFailure, string> = {
  OUT_OF_PAPER: 'Out of paper',
  COVER_OPEN: 'Printer cover open',
  OFFLINE: 'Printer offline',
  BUSY: 'Printer busy',
  TIMEOUT: 'Printer not responding',
  TRANSPORT: 'Printer connection failed',
}
