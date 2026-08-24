/**
 * Error-diffusion dithering to 1 bit.
 *
 * The printer head is 576 dots across and each dot is on or off — there is no
 * grey. Thresholding an 8-bit photo at 128 throws away everything between, so
 * the error has to go somewhere: each pixel is pushed to black or white, and the
 * difference is pushed into neighbours that have not been decided yet.
 *
 * ATKINSON is the choice, and it is not interchangeable with the obvious one.
 * Floyd–Steinberg diffuses 100% of the error, which is mathematically tidy and
 * on thermal paper looks like mud — every tone drifts toward mid-grey and faces
 * lose their edges. Atkinson diffuses only 3/4 and drops the rest on the floor.
 * Discarding a quarter of the error is what lets highlights blow to clean white
 * and shadows collapse to solid black: the image gets more contrast than it
 * really has, which is exactly what a 1-bit medium needs. That is the classic
 * early-Macintosh look, and per PHOTO_MODULE.md §4 it IS the product's
 * aesthetic, not a tuning preference.
 *
 * Floyd–Steinberg is kept only so the difference can be demonstrated on paper
 * during on-site calibration. It is not the default and should not become one.
 */

/**
 * Where each kernel sends the error, as (dx, dy, numerator) with /8 implied.
 *
 * Atkinson: six neighbours, 1/8 each — 6/8 = 3/4 distributed, 1/4 discarded.
 *
 *        X   1/8  1/8
 *   1/8 1/8  1/8
 *        1/8
 *
 * Floyd–Steinberg: 7/16 + 3/16 + 5/16 + 1/16 = 16/16, all of it.
 */
const KERNELS = {
  atkinson: {
    divisor: 8,
    taps: [
      [1, 0, 1],
      [2, 0, 1],
      [-1, 1, 1],
      [0, 1, 1],
      [1, 1, 1],
      [0, 2, 1],
    ],
  },
  'floyd-steinberg': {
    divisor: 16,
    taps: [
      [1, 0, 7],
      [-1, 1, 3],
      [0, 1, 5],
      [1, 1, 1],
    ],
  },
} as const satisfies Record<string, { divisor: number; taps: readonly (readonly number[])[] }>

export type DitherKernel = keyof typeof KERNELS

/** Fraction of the quantisation error a kernel passes on. Atkinson: 0.75. */
export function diffusionRatio(kernel: DitherKernel): number {
  const { divisor, taps } = KERNELS[kernel]
  return taps.reduce((sum, tap) => sum + (tap[2] ?? 0), 0) / divisor
}

export type Bitmap1Bit = {
  width: number
  height: number
  /**
   * One byte per pixel, 0 or 255 — not packed. Packing into the printer's bit
   * order belongs to the ESC/POS layer, and keeping this readable means the
   * preview CLI and the tests look at the same array the printer will.
   */
  pixels: Uint8Array
}

/**
 * Dither 8-bit greyscale to 1 bit in place-safe fashion.
 *
 * `gray` is one byte per pixel. The error buffer is Float32 rather than integer:
 * accumulating rounded errors across a 512×640 image drifts visibly, and the
 * cost of 1.3MB of floats on a machine that is about to run CLAHE is nothing.
 */
export function dither(
  gray: Uint8Array,
  width: number,
  height: number,
  kernel: DitherKernel = 'atkinson',
): Bitmap1Bit {
  if (width <= 0 || height <= 0) throw new Error('dither: width and height must be positive')
  if (gray.length !== width * height) {
    throw new Error(`dither: expected ${width * height} bytes, got ${gray.length}`)
  }

  const { divisor, taps } = KERNELS[kernel]
  const out = new Uint8Array(width * height)

  // Work on a float copy so a pixel can carry accumulated error beyond 0..255
  // before it is decided. Clamping here instead would quietly eat the error.
  const buffer = new Float32Array(width * height)
  for (let i = 0; i < gray.length; i += 1) buffer[i] = gray[i] as number

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      const current = buffer[index] as number
      const decided = current >= 128 ? 255 : 0
      out[index] = decided

      const error = current - decided
      if (error === 0) continue

      for (const [dx, dy, weight] of taps) {
        const nx = x + (dx as number)
        const ny = y + (dy as number)
        // Off-edge error is discarded rather than wrapped or clamped onto the
        // nearest pixel: wrapping bleeds the right edge into the left, and
        // clamping piles the whole row's error onto one column, which prints as
        // a dark stripe down the border.
        if (nx < 0 || nx >= width || ny >= height) continue
        const ni = ny * width + nx
        buffer[ni] = (buffer[ni] as number) + (error * (weight as number)) / divisor
      }
    }
  }

  return { width, height, pixels: out }
}

/**
 * Pack a 1-bit bitmap MSB-first into rows of ceil(width/8) bytes.
 *
 * This is the layout ESC/POS `GS v 0` wants, and its convention is inverted from
 * the obvious one: a SET bit means print a dot, i.e. black. So white (255) maps
 * to 0 and black (0) maps to 1. Getting this backwards produces a perfect
 * negative — which is easy to miss on screen and unmistakable on paper.
 */
export function packRaster(bitmap: Bitmap1Bit): { bytesPerRow: number; data: Uint8Array } {
  const bytesPerRow = Math.ceil(bitmap.width / 8)
  const data = new Uint8Array(bytesPerRow * bitmap.height)

  for (let y = 0; y < bitmap.height; y += 1) {
    for (let x = 0; x < bitmap.width; x += 1) {
      if ((bitmap.pixels[y * bitmap.width + x] as number) !== 0) continue // white → leave 0
      const byte = y * bytesPerRow + (x >> 3)
      data[byte] = (data[byte] as number) | (0x80 >> (x & 7))
    }
  }

  return { bytesPerRow, data }
}
