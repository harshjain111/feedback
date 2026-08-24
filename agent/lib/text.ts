import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import sharp from 'sharp'

/**
 * Text as pixels, from an embedded font.
 *
 * PHOTO_MODULE.md §5 requires the caption to be rasterised into the same bitmap
 * as the photo rather than sent as ESC/POS font codes. Two reasons, and the
 * second is the one that bites:
 *
 *  - One raster means alignment cannot drift. The printer receives a single
 *    image; there is no cursor position to get out of step, no line-height the
 *    firmware interprets its own way.
 *  - ESC/POS built-in fonts are whatever the printer vendor put in ROM. Swap the
 *    printer for the same model from a different batch and the caption changes
 *    shape. The client approved a look; this keeps it.
 *
 * Glyph outlines come from a TTF that travels with the agent, read with
 * opentype.js and converted to SVG paths. Deliberately NOT SVG <text> with a
 * font-family: that resolves through fontconfig against whatever the kiosk
 * happens to have installed, falls back silently when the face is missing, and
 * the first anyone knows is a print that looks wrong.
 */

export type TextBitmap = {
  width: number
  height: number
  /** One byte per pixel, 0 (ink) or 255 (paper). */
  pixels: Uint8Array
}

const DEFAULT_FONT = fileURLToPath(new URL('../assets/caption.ttf', import.meta.url))

const cache = new Map<string, opentype.Font>()

/** Fonts are parsed once. Every print reads the same three or four strings. */
export async function loadFont(path: string = DEFAULT_FONT): Promise<opentype.Font> {
  const cached = cache.get(path)
  if (cached) return cached

  let buffer: Buffer
  try {
    buffer = await readFile(path)
  } catch (cause) {
    throw new Error(`caption font could not be read at ${path}: ${(cause as Error).message}`)
  }

  let font: opentype.Font
  try {
    font = opentype.parse(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    )
  } catch (cause) {
    throw new Error(`caption font at ${path} is not a usable TTF/OTF: ${(cause as Error).message}`)
  }

  cache.set(path, font)
  return font
}

/** Advance width of a string at a given size, in pixels. */
export function measure(font: opentype.Font, text: string, size: number): number {
  return font.getAdvanceWidth(text, size)
}

/**
 * Break a string into lines that fit `maxWidth`, up to `maxLines`.
 *
 * Word-wrapped, and the last line is ellipsised rather than dropped: a caption
 * that runs long should end visibly, not appear to have been cut off by a fault.
 * A single word too long for the line is broken mid-word, because the
 * alternative is a line that overruns the paper.
 */
export function wrap(
  font: opentype.Font,
  text: string,
  size: number,
  maxWidth: number,
  maxLines = 2,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const lines: string[] = []
  let current = ''

  const flush = () => {
    if (current !== '') lines.push(current)
    current = ''
  }

  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`

    if (measure(font, candidate, size) <= maxWidth) {
      current = candidate
      continue
    }

    flush()

    // A single word wider than the line: hard-break it.
    if (measure(font, word, size) > maxWidth) {
      let chunk = ''
      for (const char of word) {
        if (measure(font, chunk + char, size) > maxWidth && chunk !== '') {
          lines.push(chunk)
          chunk = char
        } else {
          chunk += char
        }
      }
      current = chunk
    } else {
      current = word
    }

    if (lines.length >= maxLines) break
  }

  flush()

  if (lines.length <= maxLines) return lines

  // Over budget: keep maxLines and mark the truncation on the last one.
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1] as string
  while (last.length > 1 && measure(font, `${last}…`, size) > maxWidth) {
    last = last.slice(0, -1)
  }
  kept[maxLines - 1] = `${last}…`
  return kept
}

/**
 * Rasterise one or more centred lines into a 1-bit bitmap.
 *
 * Rendered at 3× and downsampled with a threshold rather than drawn directly at
 * final size. Glyph stems at 22px land on fractional pixel boundaries, and
 * rasterising straight to 1 bit turns that into ragged, uneven stroke weights —
 * some letters bold, some hairline. Supersampling averages the coverage first,
 * so a stem that covers 60% of a pixel becomes ink and one covering 20% does
 * not, consistently across the line.
 */
export async function renderText(
  font: opentype.Font,
  lines: string[],
  options: { size: number; width: number; lineGap?: number; threshold?: number },
): Promise<TextBitmap> {
  const { size, width, lineGap = Math.round(size * 0.35), threshold = 140 } = options

  if (lines.length === 0) return { width, height: 0, pixels: new Uint8Array(0) }

  const scale = 3
  const lineHeight = size + lineGap
  const height = lines.length * lineHeight

  // opentype's unitsPerEm-relative metrics, converted to pixels at `size`.
  const ascender = (font.ascender / font.unitsPerEm) * size

  const paths: string[] = []
  lines.forEach((line, index) => {
    const lineWidth = measure(font, line, size)
    const x = (width - lineWidth) / 2
    const y = index * lineHeight + ascender
    const path = font.getPath(line, x * scale, y * scale, size * scale)
    paths.push(path.toPathData(2))
  })

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}">` +
    `<rect width="100%" height="100%" fill="#fff"/>` +
    paths.map((d) => `<path d="${d}" fill="#000"/>`).join('') +
    `</svg>`

  const supersampled = await sharp(Buffer.from(svg))
    .resize(width, height, { kernel: 'lanczos3', fit: 'fill' })
    .greyscale()
    .toColourspace('b-w')
    .raw()
    .toBuffer()

  // Threshold, not dither: dithering body text at this size turns solid stems
  // into stipple and the caption stops being readable.
  const pixels = new Uint8Array(width * height)
  for (let i = 0; i < pixels.length; i += 1) {
    pixels[i] = (supersampled[i] as number) < threshold ? 0 : 255
  }

  return { width, height, pixels }
}
