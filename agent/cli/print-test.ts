import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { loadConfig, resolveAsset } from '../lib/config.js'
import { compose, LAYOUT } from '../lib/compose.js'
import { bitmapToPng, runPipeline } from '../lib/pipeline.js'
import { buildJob } from '../lib/escpos.js'
import { fileTransport, windowsPrinterTransport, Printer, PrintError } from '../lib/printer.js'

/**
 * pnpm print:test <input.jpg> [--share \\localhost\AIC-Thermal] [--out dir]
 *
 * On-site calibration. Without --share it composes the full print and writes
 * both a PNG of exactly what will be printed and the raw ESC/POS job, so the
 * layout can be checked before a single centimetre of paper is used. With
 * --share it sends it.
 *
 * Look for, in order: is the caption legible, is the 90px gap still there, and
 * does the cut land below the footer rather than through it.
 */

type Args = {
  input: string
  share: string | undefined
  outDir: string
  caption: string | undefined
}

function parseArgs(argv: string[]): Args {
  let input = ''
  let share: string | undefined
  let caption: string | undefined
  let outDir = 'previews'

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--share') {
      share = argv[i + 1]
      i += 1
    } else if (arg === '--out') {
      outDir = argv[i + 1] ?? outDir
      i += 1
    } else if (arg === '--caption') {
      caption = argv[i + 1]
      i += 1
    } else if (arg && !arg.startsWith('--') && input === '') {
      input = arg
    }
  }

  if (input === '') {
    throw new Error('usage: pnpm print:test <input.jpg> [--share <path>] [--caption "..."] [--out dir]')
  }
  return { input, share, outDir, caption }
}

/** "24 Aug 2026" — the footer's date half, in the café's own locale. */
function dateLabel(): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date())
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { input, outDir, caption } = args
  const config = await loadConfig()
  // --share wins over config, so a technician can aim one test at a printer
  // without editing the file they are in the middle of tuning.
  const share = args.share ?? (config.print.share === '' ? undefined : config.print.share)

  const photoResult = await runPipeline(await readFile(input), config.pipeline)

  const print = await compose({
    photo: photoResult.bitmap,
    caption: caption ?? 'Some memories are meant to be carried home.',
    footer: `All India Café · ${dateLabel()}`,
    // Empty means "not configured", which is a real state, not a missing one:
    // no logo prints without one, no font uses the bundled face.
    logoPath: resolveAsset(config.print.logo),
    fontPath: resolveAsset(config.print.font),
    rasterWidth: config.print.rasterWidth,
  })

  await mkdir(outDir, { recursive: true })
  const stem = basename(input, extname(input))

  const pngPath = join(outDir, `${stem}.print.png`)
  await writeFile(pngPath, await bitmapToPng(print, 1))

  const job = buildJob(print)
  const binPath = join(outDir, `${stem}.escpos.bin`)
  await writeFile(binPath, job)

  let ink = 0
  for (const pixel of print.pixels) if (pixel === 0) ink += 1

  console.log(`composed ${print.width}x${print.height} (${(print.height / 8).toFixed(0)}mm at 203dpi)`)
  console.log(`  polaroid gap ${LAYOUT.polaroidGap}px, ink ${((ink / print.pixels.length) * 100).toFixed(1)}%`)
  console.log(`  ${pngPath}   <- what will print`)
  console.log(`  ${binPath}   <- ${job.length} bytes of ESC/POS`)

  if (!share) {
    console.log('\nno --share given, nothing sent. Add --share "\\\\localhost\\AIC-Thermal" to print.')
    return
  }

  const printer = new Printer(share.startsWith('\\\\') ? windowsPrinterTransport(share) : fileTransport(share))
  try {
    const { ms, bytes } = await printer.print(print)
    console.log(`\nsent ${bytes} bytes via ${share} in ${ms.toFixed(0)}ms`)
  } catch (error) {
    if (error instanceof PrintError) {
      console.error(`\nprint failed: ${error.reason} — ${error.message}`)
      process.exitCode = 1
      return
    }
    throw error
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
