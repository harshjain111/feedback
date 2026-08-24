import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { parseConfig, type PipelineConfig } from '../lib/config.js'
import { coverCrop, gammaLut, runPipeline } from '../lib/pipeline.js'
import rawConfig from '../config.json' with { type: 'json' }

const CONFIG: PipelineConfig = parseConfig(rawConfig).pipeline

/**
 * A synthetic "dim café photo": a low-contrast subject, lit from one side, with
 * one blown highlight for the auto-levels step to trip over.
 *
 * Synthetic rather than a checked-in photograph, deliberately — a fixture of a
 * real person's face is not something to commit to a repo for a module whose
 * central promise is that photos are never stored. The client's real dim-light
 * photos are the acceptance checkpoint (§46) and belong on the kiosk, not here.
 */
async function dimSubject(width = 1440, height = 1080): Promise<Buffer> {
  const pixels = Buffer.allocUnsafe(width * height * 3)
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) * 0.3

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3
      // Everything sits in a 70–110 band: flat and dark, like an evening room.
      let value = 78 + (x / width) * 14

      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy < radius * radius) {
        // The subject, a shade lighter, with a soft gradient across it so CLAHE
        // has local structure to find.
        value = 96 + (dx / radius) * 12
      }

      // A ceiling lamp, top-right. Without tail clipping this alone would define
      // the top of the range and crush everything else.
      if (x > width * 0.86 && y < height * 0.1) value = 254

      pixels[i] = value
      pixels[i + 1] = value
      pixels[i + 2] = value
    }
  }

  return sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92 }).toBuffer()
}

describe('coverCrop — step 1', () => {
  it('takes the largest centred 4:5 rectangle from a landscape sensor', () => {
    // 1920x1080 at 4:5 is height-limited: 1080 tall, 864 wide.
    expect(coverCrop(1920, 1080, 4, 5)).toEqual({ left: 528, top: 0, width: 864, height: 1080 })
  })

  it('is width-limited on a frame taller than 4:5', () => {
    // 800 wide at 4:5 is 1000 tall, so 600 rows of a 1600-tall frame are dropped,
    // 300 from each end.
    expect(coverCrop(800, 1600, 4, 5)).toEqual({ left: 0, top: 300, width: 800, height: 1000 })
  })

  it('returns a rectangle that really is the requested ratio', () => {
    // Guards the arithmetic rather than one hand-computed case — the first draft
    // of the test above asserted 800x1280, which is 5:8, and would have passed
    // against a broken implementation that agreed with it.
    for (const [w, h] of [
      [1920, 1080],
      [800, 1600],
      [1440, 1080],
      [1080, 1920],
      [4032, 3024],
      [640, 640],
    ] as const) {
      const crop = coverCrop(w, h, 4, 5)
      expect(crop.width / crop.height, `${w}x${h}`).toBeCloseTo(0.8, 2)
    }
  })

  it('centres rather than anchoring high', () => {
    // The camera is above a 24" panel and people stand back from it, so faces
    // land mid-sensor. Top-anchoring would crop a tall guest's head off.
    const crop = coverCrop(1920, 1080, 4, 5)
    expect(crop.left).toBe(Math.floor((1920 - crop.width) / 2))
  })

  it('never asks for pixels outside the frame', () => {
    for (const [w, h] of [
      [640, 480],
      [1080, 1920],
      [400, 400],
      [4032, 3024],
    ] as const) {
      const crop = coverCrop(w, h, 4, 5)
      expect(crop.left + crop.width).toBeLessThanOrEqual(w)
      expect(crop.top + crop.height).toBeLessThanOrEqual(h)
      expect(crop.width).toBeGreaterThan(0)
      expect(crop.height).toBeGreaterThan(0)
    }
  })
})

describe('gammaLut — step 6', () => {
  it('lightens, because thermal heads over-deposit', () => {
    // The direction is the point. gamma > 1 must brighten; if this inverts, every
    // print comes out darker than the screen showed and the fix looks like a
    // hardware fault.
    const lut = gammaLut(1.2)
    expect(lut[128]).toBeGreaterThan(128)
    expect(lut[64]).toBeGreaterThan(64)
  })

  it('pins the endpoints so white stays white and black stays black', () => {
    const lut = gammaLut(1.2)
    expect(lut[0]).toBe(0)
    expect(lut[255]).toBe(255)
  })

  it('is monotonic', () => {
    const lut = gammaLut(1.2)
    for (let i = 1; i < 256; i += 1) {
      expect(lut[i]! >= lut[i - 1]!, `at ${i}`).toBe(true)
    }
  })

  it('is the identity at gamma 1', () => {
    const lut = gammaLut(1)
    for (let i = 0; i < 256; i += 1) expect(lut[i]).toBe(i)
  })
})

describe('runPipeline — the whole of §4', () => {
  it('turns a dim wide photo into a 1-bit portrait bitmap at print size', async () => {
    const result = await runPipeline(await dimSubject(), CONFIG)

    expect(result.bitmap.width).toBe(512)
    expect(result.bitmap.height).toBe(640) // 4:5
    expect(result.bitmap.pixels.length).toBe(512 * 640)
    for (const pixel of result.bitmap.pixels) {
      expect(pixel === 0 || pixel === 255).toBe(true)
    }
  })

  it('rescues a flat dim image into something with real range', async () => {
    // The failure this pipeline exists to prevent: the source sits in a 78–110
    // band, which thresholded at 128 would print as a solid black rectangle.
    // Auto-levels plus CLAHE plus gamma have to open that band out.
    const source = await dimSubject()

    const before = await sharp(source).greyscale().stats()
    const beforeChannel = before.channels[0]!
    expect(beforeChannel.mean).toBeLessThan(130)

    const result = await runPipeline(source, CONFIG)

    let black = 0
    for (const pixel of result.bitmap.pixels) if (pixel === 0) black += 1
    const inkShare = black / result.bitmap.pixels.length

    // Neither a black rectangle nor a blank page. Wide bounds on purpose — this
    // asserts the pipeline did something, not that a synthetic fixture lands on
    // a particular number.
    expect(inkShare).toBeGreaterThan(0.02)
    expect(inkShare).toBeLessThan(0.9)
  })

  it('is not defeated by one blown highlight', async () => {
    // The ceiling lamp in the fixture. Auto-levels clips 0.5% of each tail first
    // precisely so a single lamp cannot define the top of the range and leave
    // every face compressed into the bottom third.
    const result = await runPipeline(await dimSubject(), CONFIG)
    const distinct = new Set(result.gray)
    expect(distinct.size).toBeGreaterThan(8)
  })

  it('honours the aspect ratio from config rather than the source', async () => {
    const square: PipelineConfig = { ...CONFIG, aspect: { w: 1, h: 1 } }
    const result = await runPipeline(await dimSubject(), square)
    expect(result.bitmap.width).toBe(result.bitmap.height)
  })

  it('is deterministic end to end', async () => {
    const source = await dimSubject(720, 540)
    const a = await runPipeline(source, CONFIG)
    const b = await runPipeline(source, CONFIG)
    expect(Array.from(a.bitmap.pixels)).toEqual(Array.from(b.bitmap.pixels))
  })

  it('handles a portrait source without distorting it', async () => {
    const result = await runPipeline(await dimSubject(1080, 1920), CONFIG)
    expect(result.bitmap.width).toBe(512)
    expect(result.bitmap.height).toBe(640)
  })

  it('refuses a buffer that is not an image', async () => {
    await expect(runPipeline(Buffer.from('not a photo'), CONFIG)).rejects.toThrow()
  })
})

describe('config.json', () => {
  it('ships tuned to the §4 defaults', () => {
    expect(CONFIG.dither).toBe('atkinson')
    expect(CONFIG.clahe.clip).toBe(2.0)
    expect(CONFIG.clahe.windowPx).toBe(24)
    expect(CONFIG.gamma).toBe(1.2)
    expect(CONFIG.unsharp.radius).toBe(1.0)
    expect(CONFIG.unsharp.amount).toBe(0.6)
    expect(CONFIG.output.width).toBe(512)
    expect(CONFIG.output.kernel).toBe('lanczos3')
    expect(CONFIG.aspect).toEqual({ w: 4, h: 5 })
  })

  /** A deep copy with one pipeline field replaced, as a hand edit would. */
  function withPipelineField(key: string, value: unknown): unknown {
    const clone = structuredClone(rawConfig) as unknown as {
      pipeline: Record<string, unknown>
    }
    clone.pipeline[key] = value
    return clone
  }

  it('names the field when a hand-edited value is wrong', () => {
    // This file is edited on site, at night, by someone with a paper roll. A
    // typo must fail at startup with a message that says where, not become NaN
    // and print a black rectangle.
    expect(() => parseConfig(withPipelineField('gamma', 'bright'))).toThrow(
      /pipeline\.gamma must be a finite number/,
    )
  })

  it('rejects a gamma that would darken an already-dark print', () => {
    expect(() => parseConfig(withPipelineField('gamma', 0.8))).toThrow(
      /pipeline\.gamma must be between 1 and 3/,
    )
  })

  it('rejects a dither nobody implemented', () => {
    expect(() => parseConfig(withPipelineField('dither', 'ordered'))).toThrow(
      /pipeline\.dither must be one of/,
    )
  })
})

describe('config.json guards sharp\u2019s own limits', () => {
  /** A deep copy with one clahe field replaced. */
  function withClaheField(key: string, value: unknown): unknown {
    const clone = structuredClone(rawConfig) as unknown as {
      pipeline: { clahe: Record<string, unknown> }
    }
    clone.pipeline.clahe[key] = value
    return clone
  }

  it('rejects a fractional CLAHE clip, because sharp throws on one', () => {
    // Found the hard way during calibration: sharp's maxSlope is "Expected
    // integer between 0 and 100" and throws on 2.5. A float validated fine here
    // and then killed the agent inside a print request — the one place a
    // failure costs a guest their keepsake. Caught at startup now, with the
    // field named.
    expect(() => parseConfig(withClaheField('clip', 2.5))).toThrow(
      /pipeline\.clahe\.clip must be a whole number/,
    )
  })

  it('rejects clip 0, which removes the contrast limit entirely', () => {
    // sharp allows 0; we do not. Unlimited local contrast on a dim photo
    // amplifies sensor noise into confetti, and confetti survives dithering.
    expect(() => parseConfig(withClaheField('clip', 0))).toThrow(
      /pipeline\.clahe\.clip must be between 1 and 100/,
    )
  })

  it('rejects a fractional window size', () => {
    expect(() => parseConfig(withClaheField('windowPx', 24.5))).toThrow(
      /pipeline\.clahe\.windowPx must be a whole number/,
    )
  })

  it('rejects a window large enough to be global', () => {
    // The bug this replaced: a window sized as a fraction of the frame sees
    // essentially the whole histogram, so CLAHE becomes a no-op and the step
    // §4 calls load-bearing silently stops running.
    expect(() => parseConfig(withClaheField('windowPx', 400))).toThrow(
      /pipeline\.clahe\.windowPx must be between 4 and 256/,
    )
  })

  it('accepts every integer clip a technician might reach for', async () => {
    // The guard must not be so tight that on-site tuning is impossible.
    for (const clip of [1, 2, 3, 5, 10]) {
      const config = parseConfig(withClaheField('clip', clip)) as { pipeline: PipelineConfig }
      await expect(runPipeline(await dimSubject(480, 360), config.pipeline)).resolves.toBeTruthy()
    }
  })
})

describe('CLAHE actually runs', () => {
  /**
   * Mean per-tile standard deviation — the thing CLAHE raises and the thing a
   * global levels stretch cannot touch.
   */
  function localContrast(buf: Uint8Array, w: number, h: number, tile = 32): number {
    let sum = 0
    let n = 0
    for (let ty = 0; ty + tile <= h; ty += tile) {
      for (let tx = 0; tx + tile <= w; tx += tile) {
        let s = 0
        let ss = 0
        let c = 0
        for (let y = ty; y < ty + tile; y += 1) {
          for (let x = tx; x < tx + tile; x += 1) {
            const v = buf[y * w + x]!
            s += v
            ss += v * v
            c += 1
          }
        }
        const m = s / c
        sum += Math.sqrt(Math.max(0, ss / c - m * m))
        n += 1
      }
    }
    return sum / n
  }

  /** Textured, so local histograms have something to equalise. */
  async function textured(): Promise<Buffer> {
    const w = 900
    const h = 1125
    const px = Buffer.allocUnsafe(w * h * 3)
    let seed = 11
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 3
        let v = 70 + (y / h) * 18
        const dx = x - w * 0.5
        const dy = y - h * 0.42
        if (dx * dx + dy * dy < (w * 0.22) ** 2) v = 94 + (dx / (w * 0.22)) * 14
        v += Math.sin(x * 0.09) * Math.cos(y * 0.07) * 9 + (rnd() - 0.5) * 10
        px[i] = Math.max(0, Math.min(255, v))
        px[i + 1] = px[i]!
        px[i + 2] = px[i]!
      }
    }
    return sharp(px, { raw: { width: w, height: h, channels: 3 } })
      .jpeg({ quality: 90 })
      .toBuffer()
  }

  it('measurably raises local contrast when enabled', async () => {
    // THE regression test of this module. The first implementation read §4's
    // "8×8 tiles" as window = width/8, which on libvips — a SLIDING window, not
    // OpenCV's interpolated tile grid — is a ~120px window that sees almost the
    // whole histogram. At clip 2 the output was bit-for-bit identical to CLAHE
    // being switched off entirely: the step §4 calls "the step that makes faces
    // legible" was not running, and nothing in the build said so.
    //
    // Every other test still passed. Only measuring caught it.
    const source = await textured()

    const off = await runPipeline(source, { ...CONFIG, clahe: { ...CONFIG.clahe, enabled: false } })
    const on = await runPipeline(source, CONFIG)

    const lcOff = localContrast(off.gray, off.bitmap.width, off.bitmap.height)
    const lcOn = localContrast(on.gray, on.bitmap.width, on.bitmap.height)

    expect(lcOn).toBeGreaterThan(lcOff * 1.03)
  })

  it('changes the pixels, rather than being a silent no-op', async () => {
    const source = await textured()
    const off = await runPipeline(source, { ...CONFIG, clahe: { ...CONFIG.clahe, enabled: false } })
    const on = await runPipeline(source, CONFIG)

    let diff = 0
    for (let i = 0; i < off.gray.length; i += 1) diff += Math.abs(on.gray[i]! - off.gray[i]!)
    expect(diff / off.gray.length).toBeGreaterThan(0.5)
  })

  it('bites harder as the window shrinks', async () => {
    // Locks the direction of the knob. If a future sharp release inverts the
    // meaning of the window, this fails rather than quietly flattening prints.
    const source = await textured()

    const wide = await runPipeline(source, { ...CONFIG, clahe: { ...CONFIG.clahe, windowPx: 128 } })
    const tight = await runPipeline(source, { ...CONFIG, clahe: { ...CONFIG.clahe, windowPx: 12 } })

    expect(localContrast(tight.gray, tight.bitmap.width, tight.bitmap.height)).toBeGreaterThan(
      localContrast(wide.gray, wide.bitmap.width, wide.bitmap.height),
    )
  })
})
