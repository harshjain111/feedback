import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import type { Bitmap1Bit } from './dither.js'
import { loadFont, renderText, wrap } from './text.js'

/**
 * The finished print, as ONE 576-wide 1-bit bitmap — PHOTO_MODULE.md §5.
 *
 *         576 dots
 *   ┌────────────────────────────┐
 *   │                            │  32px top margin
 *   │      [ AIC LOGO 1-BIT ]    │  pre-dithered asset, max 320 wide
 *   │  ┌──────────────────────┐  │
 *   │  │   DITHERED PHOTO     │  │  512 × 640, centred (32px side margins)
 *   │  └──────────────────────┘  │
 *   │                            │  ← 90px WHITE GAP. The polaroid tell.
 *   │    caption line here       │
 *   │  All India Café · 24 Aug   │
 *   └────────────────────────────┘
 *              [ CUT ]
 *
 * Composed here rather than sent as separate ESC/POS image and text commands so
 * that alignment cannot drift: the printer gets one raster and has no cursor to
 * get out of step with.
 *
 * The 90px gap is not padding to be tuned away. It is the single detail that
 * makes a strip of thermal paper read as a keepsake rather than a receipt —
 * every instinct about tightening layout is wrong here.
 */

export type ComposeOptions = {
  /** The dithered photo from the pipeline, 512×640. */
  photo: Bitmap1Bit
  caption: string
  /** "All India Café · 24 Aug 2026" — composed by the caller, not here. */
  footer: string
  /** Path to a pre-dithered 1-bit logo. Absent or unreadable → no logo. */
  logoPath?: string | undefined
  fontPath?: string | undefined
  rasterWidth?: number
}

export const LAYOUT = {
  topMargin: 32,
  sideMargin: 32,
  logoMaxWidth: 320,
  logoGap: 24,
  /** §5: "do not shrink it". */
  polaroidGap: 90,
  captionSize: 26,
  captionGap: 14,
  footerSize: 20,
  bottomMargin: 28,
} as const

/** Paper is white (255); ink is black (0). */
function blank(width: number, height: number): Bitmap1Bit {
  return { width, height, pixels: new Uint8Array(width * height).fill(255) }
}

function paste(
  target: Bitmap1Bit,
  source: { width: number; height: number; pixels: Uint8Array },
  left: number,
  top: number,
): void {
  for (let y = 0; y < source.height; y += 1) {
    const ty = top + y
    if (ty < 0 || ty >= target.height) continue
    for (let x = 0; x < source.width; x += 1) {
      const tx = left + x
      if (tx < 0 || tx >= target.width) continue
      target.pixels[ty * target.width + tx] = source.pixels[y * source.width + x] as number
    }
  }
}

/**
 * Load the thermal logo and hard-threshold it to 1 bit.
 *
 * §5 requires a hand-prepared 1-bit asset. This threshold is a safety net for a
 * near-1-bit PNG, not a converter: auto-converting a vector or a greyscale logo
 * loses every thin stroke at 203dpi and prints a grey smear. If the asset is
 * wrong, the fix is a better asset, not a cleverer threshold here.
 *
 * Returns null rather than throwing. A missing logo is a print without a logo;
 * it is never a reason to deny a guest their keepsake (§7).
 */
async function loadLogo(path: string, maxWidth: number): Promise<Bitmap1Bit | null> {
  try {
    const input = await readFile(path)
    const meta = await sharp(input).metadata()
    if (!meta.width || !meta.height) return null

    const width = Math.min(maxWidth, meta.width)
    const height = Math.max(1, Math.round((meta.height * width) / meta.width))

    const raw = await sharp(input)
      .resize(width, height, { kernel: 'lanczos3', fit: 'fill' })
      .greyscale()
      .toColourspace('b-w')
      .raw()
      .toBuffer()

    const pixels = new Uint8Array(width * height)
    for (let i = 0; i < pixels.length; i += 1) {
      pixels[i] = (raw[i] as number) < 128 ? 0 : 255
    }
    return { width, height, pixels }
  } catch {
    return null
  }
}

export async function compose(options: ComposeOptions): Promise<Bitmap1Bit> {
  const width = options.rasterWidth ?? 576
  const {
    topMargin,
    sideMargin,
    logoMaxWidth,
    logoGap,
    polaroidGap,
    captionSize,
    captionGap,
    footerSize,
    bottomMargin,
  } = LAYOUT

  const contentWidth = width - sideMargin * 2

  const logo = options.logoPath
    ? await loadLogo(options.logoPath, Math.min(logoMaxWidth, contentWidth))
    : null

  const font = await loadFont(options.fontPath)

  const captionLines = wrap(font, options.caption, captionSize, contentWidth, 2)
  const captionBitmap = await renderText(font, captionLines, {
    size: captionSize,
    width: contentWidth,
  })

  const footerLines = wrap(font, options.footer, footerSize, contentWidth, 1)
  const footerBitmap = await renderText(font, footerLines, {
    size: footerSize,
    width: contentWidth,
  })

  const height =
    topMargin +
    (logo ? logo.height + logoGap : 0) +
    options.photo.height +
    polaroidGap +
    captionBitmap.height +
    (captionBitmap.height > 0 && footerBitmap.height > 0 ? captionGap : 0) +
    footerBitmap.height +
    bottomMargin

  const canvas = blank(width, height)
  let y = topMargin

  if (logo) {
    paste(canvas, logo, Math.round((width - logo.width) / 2), y)
    y += logo.height + logoGap
  }

  paste(canvas, options.photo, Math.round((width - options.photo.width) / 2), y)
  y += options.photo.height

  // The gap. Nothing is drawn into it, and that is the point.
  y += polaroidGap

  if (captionBitmap.height > 0) {
    paste(canvas, captionBitmap, sideMargin, y)
    y += captionBitmap.height
    if (footerBitmap.height > 0) y += captionGap
  }

  if (footerBitmap.height > 0) {
    paste(canvas, footerBitmap, sideMargin, y)
  }

  return canvas
}
