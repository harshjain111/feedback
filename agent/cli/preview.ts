import { readFile, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'
import { loadConfig } from '../lib/config.js'
import { diffusionRatio } from '../lib/dither.js'
import { bitmapToPng, runPipeline } from '../lib/pipeline.js'

/**
 * pnpm pipeline:preview <input.jpg> [more.jpg ...] [--out dir] [--scale N]
 *
 * Writes a side-by-side PNG per input: the greyscale at print size next to the
 * dithered result. Calibration is a visual job — you are looking for whether a
 * face survives, and no metric tells you that.
 *
 * Nothing here is on the print path. It exists so somebody can sit in the café
 * at 9pm with the real lighting and turn the dials in config.json.
 */

type Args = { inputs: string[]; outDir: string; scale: number }

function parseArgs(argv: string[]): Args {
  const inputs: string[] = []
  let outDir = 'previews'
  let scale = 1

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--out') {
      const next = argv[i + 1]
      if (!next) throw new Error('--out needs a directory')
      outDir = next
      i += 1
    } else if (arg === '--scale') {
      const next = Number(argv[i + 1])
      if (!Number.isInteger(next) || next < 1 || next > 8) {
        throw new Error('--scale needs an integer 1-8')
      }
      scale = next
      i += 1
    } else if (arg && !arg.startsWith('--')) {
      inputs.push(arg)
    }
  }

  if (inputs.length === 0) {
    throw new Error(
      'usage: pnpm pipeline:preview <input.jpg> [more.jpg ...] [--out dir] [--scale 1-8]',
    )
  }

  return { inputs, outDir, scale }
}

/** Greyscale beside dithered, on a mid-grey card so white paper reads as white. */
async function comparison(
  gray: Uint8Array,
  width: number,
  height: number,
  ditheredPng: Buffer,
  scale: number,
): Promise<Buffer> {
  const grayPng = await sharp(Buffer.from(gray), { raw: { width, height, channels: 1 } })
    .resize(width * scale, height * scale, { kernel: 'nearest' })
    .png()
    .toBuffer()

  const gap = 16
  const panelW = width * scale
  const panelH = height * scale

  return sharp({
    create: {
      width: panelW * 2 + gap * 3,
      height: panelH + gap * 2,
      channels: 3,
      background: { r: 120, g: 120, b: 120 },
    },
  })
    .composite([
      { input: grayPng, left: gap, top: gap },
      { input: ditheredPng, left: gap * 2 + panelW, top: gap },
    ])
    .png()
    .toBuffer()
}

async function main() {
  const { inputs, outDir, scale } = parseArgs(process.argv.slice(2))
  const config = await loadConfig()

  console.log(
    `pipeline: ${config.pipeline.dither} (diffuses ${Math.round(
      diffusionRatio(config.pipeline.dither) * 100,
    )}% of the error), ` +
      `CLAHE ${config.pipeline.clahe.windowPx}px window clip ${config.pipeline.clahe.clip}, ` +
      `gamma ${config.pipeline.gamma}, out ${config.pipeline.output.width}px`,
  )

  await import('node:fs/promises').then((fs) => fs.mkdir(outDir, { recursive: true }))

  for (const input of inputs) {
    const raw = await readFile(input)
    const result = await runPipeline(raw, config.pipeline)

    const stem = basename(input, extname(input))
    const ditheredPng = await bitmapToPng(result.bitmap, scale)

    const sideBySide = await comparison(
      result.gray,
      result.bitmap.width,
      result.bitmap.height,
      ditheredPng,
      scale,
    )

    const outPath = join(outDir, `${stem}.preview.png`)
    await writeFile(outPath, sideBySide)

    // Share of dots the head will actually fire. Useful as a smell test: much
    // below ~15% is a washed-out print, much above ~55% is a dark smear, and
    // either usually means gamma or CLAHE needs a nudge rather than the photo
    // being bad.
    let black = 0
    for (const pixel of result.bitmap.pixels) if (pixel === 0) black += 1
    const inkPct = ((black / result.bitmap.pixels.length) * 100).toFixed(1)

    console.log(
      `  ${stem}: ${result.source.width}x${result.source.height} -> ` +
        `${result.bitmap.width}x${result.bitmap.height}, ink ${inkPct}%, ` +
        `${result.ms.toFixed(0)}ms -> ${outPath}`,
    )
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
