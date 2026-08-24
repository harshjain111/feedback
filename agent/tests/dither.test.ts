import { describe, expect, it } from 'vitest'
import { diffusionRatio, dither, packRaster } from '../lib/dither.js'

const flat = (value: number, width: number, height: number) =>
  new Uint8Array(width * height).fill(value)

/** Mean output level of a dithered flat field — the tone the eye reads. */
function toneOf(level: number, kernel: 'atkinson' | 'floyd-steinberg', size = 64): number {
  const out = dither(flat(level, size, size), size, size, kernel)
  let sum = 0
  for (const pixel of out.pixels) sum += pixel
  return sum / out.pixels.length
}

describe('the Atkinson choice — §4', () => {
  it('diffuses exactly three quarters of the error', () => {
    // The whole reason Atkinson is specified over Floyd–Steinberg. If this ever
    // reads 1, somebody has "fixed" the kernel to conserve error and every
    // print has gone grey.
    expect(diffusionRatio('atkinson')).toBe(0.75)
    expect(diffusionRatio('floyd-steinberg')).toBe(1)
  })

  it('expands contrast around mid-grey instead of preserving tone', () => {
    // This is the behaviour §4 is buying, stated as a measurement rather than an
    // adjective. Discarding a quarter of the error makes the transfer curve an S
    // about the 128 pivot: shadows collapse toward black, highlights blow toward
    // white. "Punchy and graphic" is what that looks like on paper.
    //
    // Floyd–Steinberg conserves error, so its output tone tracks its input —
    // faithful, and on thermal paper that faithfulness is mud.
    expect(toneOf(64, 'atkinson')).toBeLessThan(64 - 10) // darks pushed down
    expect(toneOf(200, 'atkinson')).toBeGreaterThan(200 + 10) // lights pushed up

    expect(Math.abs(toneOf(64, 'floyd-steinberg') - 64)).toBeLessThan(6)
    expect(Math.abs(toneOf(200, 'floyd-steinberg') - 200)).toBeLessThan(6)
  })

  it('pivots at the 128 threshold, where both kernels agree', () => {
    // The S-curve has to cross somewhere, and it crosses at the threshold. A
    // pivot anywhere else would mean the pipeline's gamma step is correcting
    // against a moving target.
    expect(Math.abs(toneOf(128, 'atkinson') - 128)).toBeLessThan(4)
    expect(Math.abs(toneOf(128, 'floyd-steinberg') - 128)).toBeLessThan(4)
  })

  it('is monotonic — a lighter input never prints darker', () => {
    // Contrast expansion must not become tone inversion. Without this an S-curve
    // bug could brighten shadows and darken highlights and still pass the tests
    // above on the two levels they sample.
    let previous = -1
    for (const level of [0, 32, 64, 96, 128, 160, 192, 224, 255]) {
      const tone = toneOf(level, 'atkinson')
      expect(tone, `level ${level}`).toBeGreaterThanOrEqual(previous)
      previous = tone
    }
  })
})

describe('dither', () => {
  it('leaves pure black and pure white untouched', () => {
    expect([...new Set(dither(flat(255, 16, 16), 16, 16).pixels)]).toEqual([255])
    expect([...new Set(dither(flat(0, 16, 16), 16, 16).pixels)]).toEqual([0])
  })

  it('only ever emits 0 or 255 — there is no grey on a thermal head', () => {
    const noisy = new Uint8Array(32 * 32)
    for (let i = 0; i < noisy.length; i += 1) noisy[i] = (i * 37) % 256
    for (const pixel of dither(noisy, 32, 32).pixels) {
      expect(pixel === 0 || pixel === 255).toBe(true)
    }
  })

  it('does not bleed the right edge into the left of the next row', () => {
    // Off-edge error is discarded. Wrapping it would print a bright column down
    // one side of every photo and a dark one down the other.
    const width = 8
    const gray = new Uint8Array(width * 4).fill(255)
    gray[width - 1] = 0 // one dark pixel hard against the right edge

    const out = dither(gray, width, 4)
    expect(out.pixels[width + 0]).toBe(255)
    expect(out.pixels[width + 1]).toBe(255)
  })

  it('rejects a buffer that does not match its dimensions', () => {
    expect(() => dither(new Uint8Array(10), 4, 4)).toThrow(/expected 16 bytes/)
    expect(() => dither(new Uint8Array(0), 0, 4)).toThrow(/must be positive/)
  })

  it('is deterministic', () => {
    // No randomness anywhere. The same photo must print identically twice, or
    // on-site calibration is chasing noise instead of tuning anything.
    const gray = new Uint8Array(48 * 48)
    for (let i = 0; i < gray.length; i += 1) gray[i] = (i * 91) % 256
    expect(Array.from(dither(gray, 48, 48).pixels)).toEqual(
      Array.from(dither(gray, 48, 48).pixels),
    )
  })
})

describe('packRaster', () => {
  it('sets a bit for BLACK, which is what GS v 0 means by 1', () => {
    // Inverted from the intuitive mapping. Getting it backwards prints a perfect
    // negative — subtle on screen, unmistakable on paper.
    expect(packRaster({ width: 8, height: 1, pixels: new Uint8Array(8).fill(0) }).data[0]).toBe(
      0xff,
    )
    expect(packRaster({ width: 8, height: 1, pixels: new Uint8Array(8).fill(255) }).data[0]).toBe(
      0x00,
    )
  })

  it('packs MSB-first', () => {
    const pixels = new Uint8Array(8).fill(255)
    pixels[0] = 0 // leftmost pixel black → 1000 0000
    expect(packRaster({ width: 8, height: 1, pixels }).data[0]).toBe(0x80)
  })

  it('pads a partial final byte with white', () => {
    // 576 is a whole number of bytes, but the composer hands over narrower
    // sub-images and a stray set bit at the end prints as a black nub.
    const packed = packRaster({ width: 3, height: 1, pixels: new Uint8Array(3).fill(0) })
    expect(packed.bytesPerRow).toBe(1)
    expect(packed.data[0]).toBe(0b11100000)
  })

  it('gives each row its own whole number of bytes', () => {
    const packed = packRaster({ width: 9, height: 3, pixels: new Uint8Array(27).fill(255) })
    expect(packed.bytesPerRow).toBe(2)
    expect(packed.data.length).toBe(6)
  })
})
