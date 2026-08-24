/**
 * Builds the PWA icon set.
 *
 *   node scripts/generate-pwa-icons.mjs [path/to/vibrnd-logo.(svg|png)]
 *
 * The composition is the same either way — a mark with FEEDBACK set beneath it
 * on the brand green. Passing a logo swaps the mark in; passing nothing draws a
 * lettering placeholder, so the PWA is installable and correct before the
 * artwork exists and the swap is one command rather than a redesign.
 *
 * Two renders, not one file relabelled. Android crops the corners off a
 * maskable icon, so that one is drawn with its content inside the safe circle
 * (80% of the width) — reusing the 'any' icon there would slice the wordmark.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'
import opentype from 'opentype.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = path.join(ROOT, 'public', 'icons')
const FONT = path.join(ROOT, 'agent', 'assets', 'caption.ttf')

const GREEN = '#0f5132'
const IVORY = '#fbf6ec'

const source = process.argv[2]

/** Text as SVG paths, so the icon does not depend on a font being installed. */
async function textPaths(text, { size, cx, cy, letterSpacing = 0 }) {
  const buffer = await readFile(FONT)
  const font = opentype.parse(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  )

  const chars = [...text]
  const widths = chars.map((c) => font.getAdvanceWidth(c, size))
  const total = widths.reduce((a, b) => a + b, 0) + letterSpacing * (chars.length - 1)

  let x = cx - total / 2
  const paths = []
  for (const [i, char] of chars.entries()) {
    paths.push(font.getPath(char, x, cy, size).toPathData(2))
    x += widths[i] + letterSpacing
  }
  return paths
}

/**
 * One icon.
 *
 * `inset` is the fraction of the canvas the artwork is allowed to occupy — 1
 * for a normal icon, 0.8 for maskable so nothing important sits where Android
 * will round it away.
 */
async function render(size, { maskable }) {
  const inset = maskable ? 0.78 : 0.92
  const box = size * inset
  const left = (size - box) / 2

  // Mark on top, wordmark under it, as requested.
  const markH = box * 0.46
  const markY = left + box * 0.06
  const wordSize = box * 0.135
  const wordY = left + box * 0.78

  const feedback = await textPaths('FEEDBACK', {
    size: wordSize,
    cx: size / 2,
    cy: wordY,
    letterSpacing: wordSize * 0.1,
  })

  let markSvg
  if (source) {
    // A real logo is composited later; leave a hole for it.
    markSvg = ''
  } else {
    // Placeholder: VIBRND in the same lettering, sized as the mark would be.
    const vibrnd = await textPaths('VIBRND', {
      size: markH * 0.5,
      cx: size / 2,
      cy: markY + markH * 0.66,
      letterSpacing: markH * 0.04,
    })
    markSvg = vibrnd.map((d) => `<path d="${d}" fill="${IVORY}"/>`).join('')
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${GREEN}"/>
    ${markSvg}
    ${feedback.map((d) => `<path d="${d}" fill="${IVORY}" opacity="0.92"/>`).join('')}
  </svg>`

  let image = sharp(Buffer.from(svg))

  if (source) {
    const logo = await sharp(await readFile(source))
      .resize(Math.round(box * 0.72), Math.round(markH), { fit: 'inside' })
      .png()
      .toBuffer()
    const meta = await sharp(logo).metadata()
    image = sharp(
      await image
        .composite([
          {
            input: logo,
            left: Math.round((size - (meta.width ?? 0)) / 2),
            top: Math.round(markY),
          },
        ])
        .png()
        .toBuffer(),
    )
  }

  return image.png().toBuffer()
}

await mkdir(OUT, { recursive: true })

for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
]) {
  const buffer = await render(size, { maskable })
  await writeFile(path.join(OUT, name), buffer)
  console.log(`${name}  ${size}x${size}  ${(buffer.length / 1024).toFixed(1)} KB`)
}

console.log(
  source
    ? `built from ${source}`
    : 'built with the lettering placeholder — rerun with a logo path to swap the mark in',
)
