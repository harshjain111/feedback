import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * PHOTO_MODULE.md's three inviolable rules, enforced against the source.
 *
 * These are the checks Prompt 52 asks to be PROVEN rather than asserted. Each
 * fails if a future change quietly breaks the promise the module is built on —
 * which is the only kind of breakage that matters here, because all three
 * failures are silent by design and none would show up in a click-through.
 */

const ROOT = process.cwd()

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'agent', '.git'].includes(entry.name)) continue
      await walk(rel, out)
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(rel)
    }
  }
  return out
}

const read = (file: string) => readFile(join(ROOT, file), 'utf8')

/** Source with comments stripped, so prose about a rule cannot satisfy it. */
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')

describe('rule 1 — feedback commits before the camera opens', () => {
  it('gates /memory on a feedbackCode that only a committed row produces', async () => {
    const flow = await read('components/kiosk/MemoryFlow.tsx')
    expect(flow).toContain('draft.feedbackCode === null')
    expect(flow).toMatch(/feedbackCode === null[\s\S]{0,140}router\.replace\('\/thanks'\)/)
  })

  it('sets the code only from the submit response', async () => {
    expect(await read('lib/kiosk/submit.ts')).toMatch(/patchDraft\(\{ feedbackCode \}\)/)
  })

  it('routes contact to /memory only when a code came back', async () => {
    const contact = await read('components/kiosk/ContactForm.tsx')
    expect(contact).toContain("memoryEnabled && feedbackCode !== null ? '/memory' : '/thanks'")
  })
})

describe('rule 2 — the photo never leaves the machine', () => {
  it('handles image bytes in the photo module and nowhere else', async () => {
    // A fifth file touching image data is a new path off the device, and needs
    // looking at deliberately rather than arriving by accident.
    const files = [...(await walk('app')), ...(await walk('lib')), ...(await walk('components'))]

    const touching: string[] = []
    for (const file of files) {
      if (/jpegBase64|toDataURL|previewUrl/.test(await read(file))) {
        touching.push(file.replace(/\\/g, '/'))
      }
    }

    expect(touching.sort()).toEqual([
      'components/kiosk/MemoryCapture.tsx',
      'components/kiosk/MemoryFlow.tsx',
      'lib/kiosk/print-agent.ts',
    ])
  })

  it('sends image bytes to loopback and to no other origin', async () => {
    const agent = await read('lib/kiosk/print-agent.ts')
    expect(agent).toContain("const AGENT_ORIGIN = 'http://127.0.0.1:9100'")

    const fetches = agent.match(/fetch\([^,)]*/g) ?? []
    expect(fetches.length).toBeGreaterThan(0)
    for (const call of fetches) {
      expect(call, `${call} must target the local agent`).toContain('AGENT_ORIGIN')
    }
  })

  it('never lets image data reach an API route', async () => {
    for (const file of await walk('app/api')) {
      expect(await read(file), `${file} must not handle image data`).not.toMatch(
        /jpegBase64|toDataURL|previewUrl|image\/jpeg/,
      )
    }
  })

  it('never puts the frame in a browser storage that is backed by disk', async () => {
    for (const file of ['components/kiosk/MemoryCapture.tsx', 'components/kiosk/MemoryFlow.tsx']) {
      const code = stripComments(await read(file))
      expect(code, `${file} must not write the frame to storage`).not.toMatch(
        /(sessionStorage|localStorage)\.setItem/,
      )
    }
  })

  it('records uptake without sending anything about the picture', async () => {
    const route = await read('app/api/feedback/memory/route.ts')
    // strict() means an extra field is a 400 rather than silently ignored.
    expect(route).toContain('.strict()')
    for (const forbidden of ['image', 'jpeg', 'photo', 'caption', 'width', 'height']) {
      expect(route.toLowerCase(), `the uptake payload must not carry ${forbidden}`).not.toMatch(
        new RegExp(`${forbidden}:\\s*z\\.`),
      )
    }
  })
})

describe('rule 3 — the keepsake is unconditional (CLAUDE.md §14.3)', () => {
  it('is never mentioned on a rating, issue or comment screen', async () => {
    // The moment a print is mentioned while a guest is still rating, it stops
    // being a gift and becomes leverage on the score.
    const screens = [
      'app/(kiosk)/rate/page.tsx',
      'app/(kiosk)/issues/page.tsx',
      'app/(kiosk)/loved/page.tsx',
      'app/(kiosk)/comment/page.tsx',
      'components/kiosk/RateForm.tsx',
      'components/kiosk/IssuesForm.tsx',
      'components/kiosk/LovedForm.tsx',
      'components/kiosk/FaceScale.tsx',
    ]

    for (const file of screens) {
      const code = stripComments(await read(file))
      expect(code, `${file} must not mention the keepsake`).not.toMatch(
        /keepsake|thermal|printer|memory\./i,
      )
    }
  })

  it('offers it on every pathway, differing only in wording', async () => {
    const offer = await read('components/kiosk/MemoryOffer.tsx')
    expect(offer).toContain("const negative = sentiment === 'negative'")
    expect(offer).toContain('negative ? copy.negative_offer_heading : copy.offer_heading')
    // Both buttons render outside any sentiment branch.
    expect(offer).toMatch(/onTake[\s\S]{0,400}onSkip/)
  })

  it('prints the same thing whatever the rating, bar the caption', async () => {
    const flow = await read('components/kiosk/MemoryFlow.tsx')
    // Sentiment picks a caption line. It must not pick anything else.
    const uses = stripComments(flow).match(/sentiment === 'negative'/g) ?? []
    expect(uses.length).toBe(1)
    expect(flow).toContain(
      "sentiment === 'negative' ? copy.caption_line_negative : copy.caption_line",
    )
  })
})

describe('§7 — a guest is never shown an error about a free gift', () => {
  it('routes every failure to thank-you rather than to a message', async () => {
    expect(await read('components/kiosk/MemoryFlow.tsx')).toContain("router.replace('/thanks')")

    for (const file of ['components/kiosk/MemoryFlow.tsx', 'components/kiosk/MemoryCapture.tsx']) {
      const code = stripComments(await read(file))
      expect(code, `${file} must not surface an error to a guest`).not.toMatch(
        /alert\(|Something went wrong|try again/i,
      )
    }
  })

  it('never throws out of the print client', async () => {
    const agent = await read('lib/kiosk/print-agent.ts')
    expect(agent).toContain('return { ok: false, reason:')
    expect(stripComments(agent)).not.toMatch(/^\s*throw /m)
  })
})
