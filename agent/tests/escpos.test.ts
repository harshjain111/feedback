import { describe, expect, it } from 'vitest'
import type { Bitmap1Bit } from '../lib/dither.js'
import { buildJob, cut, decodeStatus, feed, initialise, raster } from '../lib/escpos.js'

/** All-white bitmap of the given size. */
const paper = (width: number, height: number): Bitmap1Bit => ({
  width,
  height,
  pixels: new Uint8Array(width * height).fill(255),
})

describe('raster — GS v 0', () => {
  it('emits the documented header', () => {
    // GS v 0 m xL xH yL yH. 576 dots = 72 bytes per row.
    const [command] = raster(paper(576, 100))
    expect(Array.from(command!.subarray(0, 8))).toEqual([
      0x1d,
      0x76,
      0x30,
      0x00, // m = normal density
      72,
      0, // xL xH — width in BYTES, little-endian
      100,
      0, // yL yH — height in dot rows
    ])
  })

  it('measures width in bytes, not pixels', () => {
    // The single easiest field to get wrong. 576 pixels is 72 bytes; sending 576
    // here makes the printer expect eight times the data and hang mid-job.
    const [command] = raster(paper(576, 8))
    expect(command![4]).toBe(72)
    expect(command![4]).not.toBe(576 & 0xff)
  })

  it('writes multi-byte fields little-endian', () => {
    // 300 rows = 0x012C -> yL 0x2C, yH 0x01. Big-endian here prints 44 rows and
    // silently drops the rest of the photo.
    const [command] = raster(paper(576, 300), 1024)
    expect(command![6]).toBe(0x2c)
    expect(command![7]).toBe(0x01)
  })

  it('carries exactly bytesPerRow * rows of payload', () => {
    const [command] = raster(paper(576, 64))
    expect(command!.length).toBe(8 + 72 * 64)
  })

  it('splits tall images into bands the printer buffer can take', () => {
    // A full keepsake is ~1000 rows. Sent as one command it can overrun a modest
    // input buffer and produce a half-printed image with no error at all, which
    // is the worst kind of failure: it looks like the pipeline is broken.
    const commands = raster(paper(576, 1000), 256)
    expect(commands.length).toBe(4)
    expect(commands.map((c) => c[6])).toEqual([256 & 0xff, 256 & 0xff, 256 & 0xff, 232])
  })

  it('bands cover every row exactly once', () => {
    const height = 1000
    const commands = raster(paper(576, height), 256)
    const rows = commands.reduce((sum, c) => sum + (c[6]! | (c[7]! << 8)), 0)
    expect(rows).toBe(height)
  })

  it('rejects a bitmap whose buffer does not match its dimensions', () => {
    expect(() => raster({ width: 8, height: 8, pixels: new Uint8Array(10) })).toThrow(
      /expected 64 pixels/,
    )
  })
})

describe('job assembly', () => {
  it('resets, prints, feeds clear of the head, then cuts', () => {
    const job = buildJob(paper(576, 16))

    expect(Array.from(job.subarray(0, 2))).toEqual([0x1b, 0x40]) // ESC @
    expect(Array.from(job.subarray(2, 6))).toEqual([0x1d, 0x76, 0x30, 0x00]) // GS v 0

    // ESC d 2, then GS V 66 4.
    const tail = Array.from(job.subarray(job.length - 7))
    expect(tail).toEqual([0x1b, 0x64, 2, 0x1d, 0x56, 66, 4])
  })

  it('feeds before cutting, because the blade sits downstream of the head', () => {
    // Without the feed the cut lands inside the footer line.
    const bytes = Array.from(cut())
    expect(bytes[3]).toBeGreaterThan(0)
  })

  it('uses a partial cut so the print does not drop on the floor', () => {
    // 66 = feed and partial cut, leaving a tab holding it to the roll. Nobody is
    // standing behind a kiosk to catch a full-cut print.
    expect(Array.from(cut())[2]).toBe(66)
  })

  it('refuses out-of-range feed and cut values', () => {
    expect(() => feed(-1)).toThrow(/integer 0-255/)
    expect(() => feed(300)).toThrow(/integer 0-255/)
    expect(() => cut(1.5)).toThrow(/integer 0-255/)
  })

  it('is deterministic', () => {
    const a = buildJob(paper(576, 32))
    const b = buildJob(paper(576, 32))
    expect(Array.from(a)).toEqual(Array.from(b))
  })

  it('starts every job with a reset', () => {
    // Whatever the previous job left set — double-height, inverted, a rotated
    // print mode from someone's test — is cleared before the guest's photo.
    expect(Array.from(initialise())).toEqual([0x1b, 0x40])
  })
})

describe('decodeStatus', () => {
  it('reads an idle, healthy printer as fine', () => {
    // 0x12 / 0x12 are the resting values: bit 4 set, bit 0 clear.
    const state = decodeStatus(0x12, 0x12)
    expect(state).toEqual({ paperOut: false, paperLow: false, coverOpen: false, offline: false })
  })

  it('distinguishes low paper from no paper', () => {
    // These drive different behaviour: low is a badge in the admin, out is an
    // auto-disable. Conflating them either cries wolf or fails silently.
    expect(decodeStatus(0x12 | 0x0c, 0x12).paperLow).toBe(true)
    expect(decodeStatus(0x12 | 0x0c, 0x12).paperOut).toBe(false)
    expect(decodeStatus(0x12 | 0x60, 0x12).paperOut).toBe(true)
  })

  it('reads cover open and offline separately', () => {
    expect(decodeStatus(0x12, 0x12 | 0x04).coverOpen).toBe(true)
    expect(decodeStatus(0x12, 0x12 | 0x08).offline).toBe(true)
  })
})
