/**
 * Builds the PWA icon set: the Vibrnd lockup with FEEDBACK set beneath it.
 *
 *   node scripts/generate-pwa-icons.mjs [path/to/logo.png]
 *
 * Defaults to public/brand/vibrnd-logo.png. Black ground rather than the app's
 * green: the logo was supplied white-on-black, that is the mark's own
 * presentation, and an app icon sits on a wallpaper the café chose rather than
 * inside the app's palette.
 *
 * Two renders, not one file relabelled. Android crops the corners off a
 * maskable icon, so that one is laid out inside the safe circle — reusing the
 * 'any' icon there would slice the wordmark, which is most of the content.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'
import opentype from 'opentype.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = path.join(ROOT, 'public', 'icons')
const FONT = path.join(ROOT, 'agent', 'assets', 'caption.ttf')
const LOGO = process.argv[2] ?? path.join(ROOT, 'public', 'brand', 'vibrnd-logo.png')

const GROUND = '#000000'
const INK = '#ffffff'

/** Text as SVG paths, so the icon never depends on an installed font. */
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
 * `inset` is how much of the canvas the artwork may use — generous for a normal
 * icon, tight for maskable so nothing important sits where Android rounds it
 * away. The lockup and the word are laid out as one group and centred together,
 * so the pair stays optically balanced at every size instead of drifting apart.
 */
async function render(size, { maskable }) {
  const inset = maskable ? 0.7 : 0.86
  const box = Math.round(size * inset)

  const logoBuffer = await readFile(LOGO)
  const logoMeta = await sharp(logoBuffer).metadata()
  const aspect = (logoMeta.width ?? 1) / (logoMeta.height ?? 1)

  const logoW = box
  const logoH = Math.round(logoW / aspect)

  const wordSize = Math.round(box * 0.155)
  const gap = Math.round(box * 0.14)

  const groupH = logoH + gap + wordSize
  const top = Math.round((size - groupH) / 2)

  const logo = await sharp(logoBuffer)
    .resize(logoW, logoH, { fit: 'inside', kernel: 'lanczos3' })
    .png()
    .toBuffer()

  // Baseline of the word, measured from the top of the group.
  const wordBaseline = top + logoH + gap + wordSize * 0.78

  const feedback = await textPaths('FEEDBACK', {
    size: wordSize,
    cx: size / 2,
    cy: wordBaseline,
    letterSpacing: wordSize * 0.14,
  })

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${GROUND}"/>
    ${feedback.map((d) => `<path d="${d}" fill="${INK}"/>`).join('')}
  </svg>`

  return sharp(Buffer.from(svg))
    .composite([{ input: logo, left: Math.round((size - logoW) / 2), top }])
    .png()
    .toBuffer()
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

console.log(`built from ${path.relative(ROOT, LOGO)}`)
