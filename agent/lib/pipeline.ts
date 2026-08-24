import sharp from 'sharp'
import { dither, type Bitmap1Bit } from './dither.js'
import type { PipelineConfig } from './config.js'

/**
 * Photo → 1-bit bitmap, per PHOTO_MODULE.md §4.
 *
 * The whole product lives here. 576 dots across and one bit deep is a brutal
 * medium: a raw phone-quality photo pushed straight through it is unreadable
 * mud, and no amount of clever composition downstream rescues it. The ordering
 * below is the spec's, and it is load-bearing rather than incidental —
 *
 *   1  crop to 4:5          frame consistency
 *   2  luminance greyscale  0.299/0.587/0.114, not a channel average
 *   3  auto-levels          café lighting is dim and flat; use the whole range
 *   4  CLAHE                local contrast — THE step that makes faces legible
 *   5  unsharp              restore edge definition before it gets quantised
 *   6  gamma                thermal heads over-deposit, so prints run dark
 *   7  downscale to 512     Lanczos, final print size
 *   8  Atkinson dither      to 1 bit
 *
 * sharp reorders some operations internally regardless of call order, so the
 * chain is deliberately broken into three passes with the buffer materialised
 * between them. Slower, and the only way to be sure step 4 happens after step 3
 * rather than whenever libvips felt like it.
 */

export type PipelineResult = {
  bitmap: Bitmap1Bit
  /** Greyscale at final size, before dithering. What the CLI previews. */
  gray: Uint8Array
  source: { width: number; height: number }
  ms: number
}

/**
 * Largest centred 4:5 rectangle inside the frame.
 *
 * Centred, not top-anchored: the camera sits above a 24" panel and people stand
 * back from it, so faces land near the middle of a 16:9 sensor. Anchoring high
 * would crop a tall guest's head off, which is a worse failure than losing some
 * table.
 */
export function coverCrop(
  width: number,
  height: number,
  aspectW: number,
  aspectH: number,
): { left: number; top: number; width: number; height: number } {
  const target = aspectW / aspectH
  let cropW = width
  let cropH = Math.round(width / target)

  if (cropH > height) {
    cropH = height
    cropW = Math.round(height * target)
  }

  return {
    left: Math.max(0, Math.floor((width - cropW) / 2)),
    top: Math.max(0, Math.floor((height - cropH) / 2)),
    width: Math.min(cropW, width),
    height: Math.min(cropH, height),
  }
}

/**
 * Build a 256-entry gamma lookup table.
 *
 * `out = 255 · (in/255)^(1/gamma)`, so gamma > 1 lightens. Done as an explicit
 * LUT rather than through sharp's `.gamma()`, which is defined as a
 * decode-before-resize / encode-after-resize pair for linear-light resampling.
 * That is a different operation with a different result, and §4 places this
 * BEFORE the downscale — a correction for the printer's over-deposit, not for
 * the resampler. Being explicit also makes it testable in isolation.
 */
export function gammaLut(gamma: number): Uint8Array {
  const lut = new Uint8Array(256)
  const inverse = 1 / gamma
  for (let i = 0; i < 256; i += 1) {
    lut[i] = Math.max(0, Math.min(255, Math.round(255 * Math.pow(i / 255, inverse))))
  }
  return lut
}

function expectSingleChannel(channels: number | undefined, where: string): void {
  if (channels !== 1) {
    throw new Error(
      `pipeline: expected 1 channel ${where}, got ${channels}. ` +
        'sharp has stopped honouring toColourspace("b-w") on a raw read.',
    )
  }
}

export async function runPipeline(
  input: Buffer,
  config: PipelineConfig,
): Promise<PipelineResult> {
  const startedAt = process.hrtime.bigint()

  const metadata = await sharp(input).metadata()
  const srcWidth = metadata.width
  const srcHeight = metadata.height
  if (!srcWidth || !srcHeight) throw new Error('pipeline: could not read the image dimensions')

  // --- 1 crop, 2 greyscale ---------------------------------------------------
  const crop = coverCrop(srcWidth, srcHeight, config.aspect.w, config.aspect.h)

  let stage = sharp(input)
    .rotate() // honour EXIF orientation before cropping, or the crop is sideways
    .extract(crop)
    // sharp's greyscale is luminance-weighted (Rec.601), which is what §4 asks
    // for. A naive (r+g+b)/3 renders a red kurta and a green plant as the same
    // tone, and at 1 bit that difference is all there is.
    .greyscale()

  // --- 3 auto-levels ---------------------------------------------------------
  // Clipping the tails before stretching matters: a single blown highlight — a
  // ceiling lamp in frame — would otherwise define the top of the range and
  // leave every face compressed into the bottom third.
  if (config.autoLevels.enabled) {
    stage = stage.normalise({
      lower: config.autoLevels.clipLowPct,
      upper: 100 - config.autoLevels.clipHighPct,
    })
  }

  // --- 4 CLAHE ---------------------------------------------------------------
  // Global levels cannot fix a face lit from one side. CLAHE equalises within
  // tiles, so the shadowed half of a face gets its own contrast curve. This is
  // the step that decides whether the print is a person or a silhouette.
  //
  // The window is passed straight through in pixels rather than derived from a
  // tile count — see the long note in config.ts. libvips slides one window, it
  // does not build OpenCV's interpolated tile grid, so a window sized as a
  // fraction of the frame is large enough to be global and does nothing.
  //
  // Square, because a face is not wider than it is tall in any way that a local
  // histogram cares about.
  if (config.clahe.enabled) {
    stage = stage.clahe({
      width: config.clahe.windowPx,
      height: config.clahe.windowPx,
      maxSlope: config.clahe.clip,
    })
  }

  // --- 5 unsharp -------------------------------------------------------------
  // Before the dither, not after: dithering destroys the gradients an unsharp
  // mask works on. sharp's sigma is the Gaussian radius; m1 is left at 0 so flat
  // areas are untouched — sharpening dim flat wall is how you get noise
  // promoted into speckle, and speckle survives dithering all too well.
  if (config.unsharp.enabled) {
    stage = stage.sharpen({
      sigma: config.unsharp.radius,
      m1: 0,
      m2: config.unsharp.amount,
    })
  }

  // toColourspace('b-w') on every raw read, not just for tidiness: sharp
  // promotes a single-band raw buffer to 3 interleaved channels across a
  // resize, so without this the byte count silently triples and the dither
  // receives RGB it will read as garbage. Asserting the channel count too, so a
  // future libvips change fails here with a useful message rather than three
  // steps downstream.
  const levelled = await stage.toColourspace('b-w').raw().toBuffer({ resolveWithObject: true })
  expectSingleChannel(levelled.info.channels, 'after levels')

  // --- 6 gamma --------------------------------------------------------------
  const lut = gammaLut(config.gamma)
  const brightened = Buffer.allocUnsafe(levelled.data.length)
  for (let i = 0; i < levelled.data.length; i += 1) {
    brightened[i] = lut[levelled.data[i] as number] as number
  }

  // --- 7 downscale ---------------------------------------------------------
  // Last before the dither, so every earlier step ran at full resolution and the
  // resampler averages real detail rather than already-quantised blocks.
  const finalHeight = Math.round(
    (config.output.width * config.aspect.h) / config.aspect.w,
  )

  const resized = await sharp(brightened, {
    raw: {
      width: levelled.info.width,
      height: levelled.info.height,
      channels: 1,
    },
  })
    .resize(config.output.width, finalHeight, {
      kernel: config.output.kernel,
      fit: 'fill',
    })
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true })

  expectSingleChannel(resized.info.channels, 'after resize')

  const gray = new Uint8Array(resized.data)

  // --- 8 dither ------------------------------------------------------------
  const bitmap = dither(gray, resized.info.width, resized.info.height, config.dither)

  return {
    bitmap,
    gray,
    source: { width: srcWidth, height: srcHeight },
    ms: Number(process.hrtime.bigint() - startedAt) / 1e6,
  }
}

/** A 1-bit bitmap back to a PNG, for previews and tests. Never for printing. */
export async function bitmapToPng(bitmap: Bitmap1Bit, scale = 1): Promise<Buffer> {
  const image = sharp(Buffer.from(bitmap.pixels), {
    raw: { width: bitmap.width, height: bitmap.height, channels: 1 },
  })

  if (scale !== 1) {
    // Nearest-neighbour: any smoothing kernel would blend the dots back into
    // greys and show a preview that the printer cannot produce.
    return image
      .resize(bitmap.width * scale, bitmap.height * scale, { kernel: 'nearest' })
      .png()
      .toBuffer()
  }

  return image.png().toBuffer()
}
