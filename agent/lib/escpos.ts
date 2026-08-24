import { packRaster, type Bitmap1Bit } from './dither.js'

/**
 * ESC/POS command bytes.
 *
 * Kept separate from the transport (printer.ts) on purpose: what to send is
 * exactly testable and what it travels down a USB cable is not. Everything in
 * this file is a pure function from a bitmap to bytes, so the wire format can be
 * asserted byte-for-byte on a machine with no printer attached — which is the
 * only machine this will be developed on until the kiosk arrives.
 */

export const ESC = 0x1b
export const GS = 0x1d

/** ESC @ — reset. Clears whatever state a previous job left behind. */
export function initialise(): Uint8Array {
  return new Uint8Array([ESC, 0x40])
}

/** ESC d n — feed n lines. */
export function feed(lines: number): Uint8Array {
  if (!Number.isInteger(lines) || lines < 0 || lines > 255) {
    throw new Error(`feed: lines must be an integer 0-255, got ${lines}`)
  }
  return new Uint8Array([ESC, 0x64, lines])
}

/**
 * GS V m — cut.
 *
 * 66 is "feed then partial cut": partial leaves a small tab holding the print to
 * the roll so it does not drop on the floor before the guest takes it, which is
 * what you want on a kiosk nobody is standing behind. `n` is the feed before the
 * blade — without it the cut lands inside the footer, because the cutter sits a
 * few millimetres downstream of the head.
 */
export function cut(feedBefore = 4): Uint8Array {
  if (!Number.isInteger(feedBefore) || feedBefore < 0 || feedBefore > 255) {
    throw new Error(`cut: feedBefore must be an integer 0-255, got ${feedBefore}`)
  }
  return new Uint8Array([GS, 0x56, 66, feedBefore])
}

/** DLE EOT n — real-time status. Answered even mid-job, unlike GS r. */
export function statusRequest(kind: 'printer' | 'offline' | 'error' | 'paper'): Uint8Array {
  const n = { printer: 1, offline: 2, error: 3, paper: 4 }[kind]
  return new Uint8Array([0x10, 0x04, n])
}

/**
 * GS v 0 — print a raster bitmap.
 *
 *   GS  v   0   m  xL xH yL yH  [data]
 *
 * `m = 0` is normal density. xL/xH is the row width in BYTES (not pixels);
 * yL/yH is the height in dot rows. Both little-endian.
 *
 * The height field is 16 bits, so a single command tops out at 65535 rows — far
 * more than a keepsake needs, but chunking is still the right shape: many
 * printers have a modest input buffer and a 576×1200 image sent as one command
 * can overrun it and produce a half-printed image with no error. Splitting into
 * bands lets the printer drain between them.
 */
export function raster(bitmap: Bitmap1Bit, bandRows = 256): Uint8Array[] {
  if (bitmap.width <= 0 || bitmap.height <= 0) {
    throw new Error('raster: bitmap must have positive dimensions')
  }
  if (bitmap.pixels.length !== bitmap.width * bitmap.height) {
    throw new Error(
      `raster: expected ${bitmap.width * bitmap.height} pixels, got ${bitmap.pixels.length}`,
    )
  }

  const { bytesPerRow, data } = packRaster(bitmap)
  const commands: Uint8Array[] = []

  for (let top = 0; top < bitmap.height; top += bandRows) {
    const rows = Math.min(bandRows, bitmap.height - top)
    const body = data.subarray(top * bytesPerRow, (top + rows) * bytesPerRow)

    const header = new Uint8Array([
      GS,
      0x76,
      0x30,
      0x00,
      bytesPerRow & 0xff,
      (bytesPerRow >> 8) & 0xff,
      rows & 0xff,
      (rows >> 8) & 0xff,
    ])

    const command = new Uint8Array(header.length + body.length)
    command.set(header, 0)
    command.set(body, header.length)
    commands.push(command)
  }

  return commands
}

/** The whole job: reset, image, feed clear of the head, cut. */
export function buildJob(bitmap: Bitmap1Bit): Uint8Array {
  const parts = [initialise(), ...raster(bitmap), feed(2), cut()]
  const total = parts.reduce((sum, part) => sum + part.length, 0)

  const job = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    job.set(part, offset)
    offset += part.length
  }
  return job
}

/**
 * Decode a DLE EOT 4 (paper) or DLE EOT 2 (offline) response byte.
 *
 * ESC/POS status bytes always have bit 0 clear and bit 4 set, which is how you
 * tell a status byte from stray data on the line. Everything else is a flag.
 */
export type PrinterState = {
  paperOut: boolean
  paperLow: boolean
  coverOpen: boolean
  offline: boolean
}

export function decodeStatus(paperByte: number, offlineByte: number): PrinterState {
  return {
    // Bits 2-3 both set means the near-end sensor says out of paper.
    paperLow: (paperByte & 0x0c) !== 0,
    // Bits 5-6 both set means the roll has actually run out.
    paperOut: (paperByte & 0x60) !== 0,
    coverOpen: (offlineByte & 0x04) !== 0,
    // Bit 3 set means the printer is offline for any reason.
    offline: (offlineByte & 0x08) !== 0,
  }
}
