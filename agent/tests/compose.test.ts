import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { Bitmap1Bit } from '../lib/dither.js'
import { compose, LAYOUT } from '../lib/compose.js'
import { loadFont, measure, renderText, wrap } from '../lib/text.js'
import { Printer, PrintError, fileTransport } from '../lib/printer.js'

const scratch = await mkdtemp(join(tmpdir(), 'aic-print-'))
afterAll(() => rm(scratch, { recursive: true, force: true }))

/** A photo-shaped block of solid ink, so its extent is easy to find. */
const photo = (width = 512, height = 640): Bitmap1Bit => ({
  width,
  height,
  pixels: new Uint8Array(width * height).fill(0),
})

/** Rows in [top, bottom) that contain no ink at all. */
function blankRows(bitmap: Bitmap1Bit, top: number, bottom: number): number {
  let count = 0
  for (let y = top; y < bottom; y += 1) {
    let ink = false
    for (let x = 0; x < bitmap.width; x += 1) {
      if (bitmap.pixels[y * bitmap.width + x] === 0) {
        ink = true
        break
      }
    }
    if (!ink) count += 1
  }
  return count
}

function firstInkRow(bitmap: Bitmap1Bit, from = 0): number {
  for (let y = from; y < bitmap.height; y += 1) {
    for (let x = 0; x < bitmap.width; x += 1) {
      if (bitmap.pixels[y * bitmap.width + x] === 0) return y
    }
  }
  return -1
}

describe('compose — §5 layout', () => {
  it('is exactly the print head wide', async () => {
    const print = await compose({ photo: photo(), caption: 'A line.', footer: 'All India Café' })
    expect(print.width).toBe(576)
  })

  it('keeps the 90px polaroid gap intact', async () => {
    // THE detail of this layout. §5 says "do not shrink it" — it is the single
    // thing that makes a strip of thermal paper read as a keepsake rather than a
    // receipt, and every instinct about tightening a layout is wrong here.
    const print = await compose({ photo: photo(), caption: 'A line.', footer: 'All India Café' })

    const photoBottom = LAYOUT.topMargin + 640
    expect(blankRows(print, photoBottom, photoBottom + LAYOUT.polaroidGap)).toBe(
      LAYOUT.polaroidGap,
    )
    // And the caption starts right after it, not somewhere further down.
    expect(firstInkRow(print, photoBottom)).toBeGreaterThanOrEqual(
      photoBottom + LAYOUT.polaroidGap,
    )
  })

  it('centres the photo with equal side margins', async () => {
    const print = await compose({ photo: photo(), caption: 'A line.', footer: 'x' })
    const row = LAYOUT.topMargin + 10
    let left = -1
    let right = -1
    for (let x = 0; x < print.width; x += 1) {
      if (print.pixels[row * print.width + x] === 0) {
        if (left === -1) left = x
        right = x
      }
    }
    expect(left).toBe(LAYOUT.sideMargin)
    expect(print.width - 1 - right).toBe(LAYOUT.sideMargin)
  })

  it('leaves the top margin clear', async () => {
    const print = await compose({ photo: photo(), caption: 'A line.', footer: 'x' })
    expect(blankRows(print, 0, LAYOUT.topMargin)).toBe(LAYOUT.topMargin)
  })

  it('prints without a logo rather than failing when the asset is missing', async () => {
    // §7: any failure in the photo layer routes silently onward. A missing logo
    // must never cost a guest their keepsake.
    const print = await compose({
      photo: photo(),
      caption: 'A line.',
      footer: 'x',
      logoPath: join(scratch, 'nope.png'),
    })
    expect(print.height).toBeGreaterThan(640)
    expect(firstInkRow(print)).toBe(LAYOUT.topMargin)
  })

  it('grows taller when the caption wraps to two lines', async () => {
    const short = await compose({ photo: photo(), caption: 'Short.', footer: 'x' })
    const long = await compose({
      photo: photo(),
      caption:
        'Some memories are meant to be carried home, and this one belongs to you and yours.',
      footer: 'x',
    })
    expect(long.height).toBeGreaterThan(short.height)
  })

  it('never overruns the paper width, whatever the caption', async () => {
    const print = await compose({
      photo: photo(),
      caption: 'Supercalifragilisticexpialidociousandthensomemoreforgoodmeasureindeed',
      footer: 'All India Café · 24 Aug 2026',
    })
    // Column 0 and the last column must stay clear — ink there means text ran
    // past the margin and would print hard against the paper edge.
    for (let y = 0; y < print.height; y += 1) {
      expect(print.pixels[y * print.width]).toBe(255)
      expect(print.pixels[y * print.width + print.width - 1]).toBe(255)
    }
  })
})

describe('text', () => {
  it('wraps to at most the line count it is given', async () => {
    const font = await loadFont()
    const lines = wrap(font, 'one two three four five six seven eight nine ten', 26, 500, 2)
    expect(lines.length).toBeLessThanOrEqual(2)
  })

  it('ellipsises rather than silently dropping the tail', async () => {
    // A caption that runs long should end visibly. Truncating without a mark
    // looks like the printer gave up mid-sentence.
    const font = await loadFont()
    const lines = wrap(
      font,
      'one two three four five six seven eight nine ten eleven twelve thirteen fourteen',
      26,
      300,
      2,
    )
    expect(lines.length).toBe(2)
    expect(lines[1]!.endsWith('…')).toBe(true)
  })

  it('every wrapped line fits the width it was given', async () => {
    const font = await loadFont()
    const width = 400
    for (const line of wrap(font, 'the quick brown fox jumps over the lazy dog', 26, width, 4)) {
      expect(measure(font, line, 26)).toBeLessThanOrEqual(width)
    }
  })

  it('breaks a single word too long for the line', async () => {
    const font = await loadFont()
    const lines = wrap(font, 'antidisestablishmentarianismandthensome', 26, 150, 3)
    expect(lines.length).toBeGreaterThan(1)
  })

  it('renders ink, and only pure black or white', async () => {
    const font = await loadFont()
    const bitmap = await renderText(font, ['All India Café'], { size: 26, width: 500 })
    let ink = 0
    for (const pixel of bitmap.pixels) {
      expect(pixel === 0 || pixel === 255).toBe(true)
      if (pixel === 0) ink += 1
    }
    expect(ink).toBeGreaterThan(50)
  })

  it('renders the é in Café — the caption is not ASCII', async () => {
    const font = await loadFont()
    const withAccent = await renderText(font, ['Café'], { size: 26, width: 200 })
    const without = await renderText(font, ['Cafe'], { size: 26, width: 200 })

    const count = (b: { pixels: Uint8Array }) => b.pixels.reduce((n, p) => n + (p === 0 ? 1 : 0), 0)
    expect(count(withAccent)).toBeGreaterThan(count(without))
  })

  it('is empty for empty input rather than throwing', async () => {
    const font = await loadFont()
    const bitmap = await renderText(font, [], { size: 26, width: 500 })
    expect(bitmap.height).toBe(0)
  })

  it('reports a missing font by path', async () => {
    await expect(loadFont(join(scratch, 'absent.ttf'))).rejects.toThrow(/could not be read/)
  })
})

describe('Printer', () => {
  it('writes a complete job through its transport', async () => {
    const path = join(scratch, 'job.bin')
    const printer = new Printer(fileTransport(path))
    const result = await printer.print(photo(576, 64))

    const written = await readFile(path)
    expect(written.length).toBe(result.bytes)
    expect(Array.from(written.subarray(0, 2))).toEqual([0x1b, 0x40])
  })

  it('refuses a second job while one is in flight', async () => {
    // Two prints interleaved on one ESC/POS connection do not produce two
    // prints — they produce one corrupt raster, and the guest gets noise.
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    const printer = new Printer({
      name: 'slow',
      write: async () => {
        await gate
      },
    })

    const first = printer.print(photo(576, 8))
    await expect(printer.print(photo(576, 8))).rejects.toMatchObject({ reason: 'BUSY' })

    release()
    await first
  })

  it('frees the queue after a failure, so one jam is not an evening of them', async () => {
    const printer = new Printer({
      name: 'broken',
      write: async () => {
        throw new PrintError('OFFLINE', 'nope')
      },
    })

    await expect(printer.print(photo(576, 8))).rejects.toMatchObject({ reason: 'OFFLINE' })
    expect(printer.busy).toBe(false)
  })

  it('times out rather than hanging the journey', async () => {
    const printer = new Printer(
      { name: 'silent', write: () => new Promise<void>(() => {}) },
      50,
    )
    await expect(printer.print(photo(576, 8))).rejects.toMatchObject({ reason: 'TIMEOUT' })
    expect(printer.busy).toBe(false)
  })

  it('reports an unreachable transport as a typed failure', async () => {
    const printer = new Printer(fileTransport(join(scratch, 'no', 'such', 'dir', 'x.bin')))
    await expect(printer.print(photo(576, 8))).rejects.toMatchObject({ reason: 'TRANSPORT' })
  })
})
