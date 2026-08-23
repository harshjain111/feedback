import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { freshDb, one, outletId, rows, type Db } from './harness'

/**
 * Every string the guest can read must still match CLAUDE.md §5 character for
 * character. This test re-reads the spec rather than trusting the migration:
 * if someone "improves" a line in the seed, this fails.
 */
let lockedStrings: Set<string>

beforeAll(async () => {
  const spec = await readFile(join(process.cwd(), 'CLAUDE.md'), 'utf8')
  const section5 = spec.split('## 5. LOCKED COPY')[1]?.split('## 6.')[0] ?? ''
  expect(section5.length, 'could not locate §5 in CLAUDE.md').toBeGreaterThan(500)

  lockedStrings = new Set<string>()
  for (const match of section5.matchAll(/`([^`]*)`/g)) {
    const value = match[1]
    if (!value) continue
    lockedStrings.add(value)
    // The persistent footer is one middot-separated line; its labels are seeded
    // individually, so allow each part too.
    if (value.includes('·')) {
      for (const part of value.split('·')) lockedStrings.add(part.trim())
    }
  }
})

/** Sections whose strings are locked copy, minus the keys we authored. */
const LOCKED_SECTIONS = [
  'welcome',
  'rate',
  'negative',
  'positive',
  'comment',
  'followup',
  'contact',
  'thanks',
  'footer',
  'grievance',
]

/**
 * Strings in a locked section that are NOT from §5, so the verbatim check skips
 * them. Every entry here is a deliberate decision that needs client sign-off —
 * adding one should feel like a cost.
 */
const AUTHORED_KEYS = new Set([
  'contact.followup_sub',
  'contact.phone_hint',
  'grievance.name',
  'grievance.phone',
  'grievance.email',
  'negative.chips_hint',
  'followup.yes_sub',
])

/**
 * Every migration, not just 0002.
 *
 * Scoping this to 0002 meant a later migration could add a customer-facing
 * string to a locked section and slip past the §5 drift check entirely —
 * which 0008 promptly did. Applying the full chain closes that.
 */
async function seededDb(): Promise<Db> {
  return freshDb()
}

describe('0002 — locked copy', () => {
  it('seeds every customer-facing string verbatim from CLAUDE.md §5', async () => {
    const db = await seededDb()
    const config = await rows<{ key: string; section: string; value: string }>(
      db,
      `select key, section, value #>> '{}' as value
       from app_config
       where section = any($1)
       order by key`,
      [LOCKED_SECTIONS],
    )

    expect(config.length).toBeGreaterThan(35)

    const mismatches: string[] = []
    for (const row of config) {
      if (AUTHORED_KEYS.has(row.key)) continue
      if (!lockedStrings.has(row.value))
        mismatches.push(`${row.key} = ${JSON.stringify(row.value)}`)
    }

    expect(
      mismatches,
      `these seeded strings are not in CLAUDE.md §5:\n${mismatches.join('\n')}`,
    ).toEqual([])

    await db.close()
  })

  it('keeps the load-bearing permission-to-criticise line intact', async () => {
    const db = await seededDb()
    const row = await one<{ value: string }>(
      db,
      `select value #>> '{}' as value from app_config where key = 'rate.sub'`,
    )
    expect(row.value).toBe('Good, bad or somewhere in between — tell us honestly.')
    await db.close()
  })

  it('uses no forbidden escalation language on the follow-up screen', async () => {
    const db = await seededDb()
    const config = await rows<{ value: string }>(
      db,
      `select value #>> '{}' as value from app_config where section = 'followup'`,
    )
    const joined = config
      .map((r) => r.value)
      .join(' ')
      .toLowerCase()
    for (const banned of ['complaint', 'lodge', 'manager']) {
      expect(joined, `follow-up copy must not say "${banned}" (§5)`).not.toContain(banned)
    }
    await db.close()
  })
})

describe('0002 — reference data', () => {
  it('seeds one outlet and one kiosk', async () => {
    const db = await seededDb()
    const outlet = await one<{ name: string; code: string }>(db, `select name, code from outlets`)
    expect(outlet.code).toBe('AIC')
    expect(outlet.name).toBe('All India Café')

    const kiosk = await one<{ label: string }>(db, `select label from kiosks`)
    expect(kiosk.label).toBe('Entrance Kiosk')
    await db.close()
  })

  it('seeds the four categories in order with their §5 questions and icons', async () => {
    const db = await seededDb()
    const cats = await rows<{
      name: string
      question: string
      icon: string
      display_order: number
    }>(db, `select name, question, icon, display_order from categories order by display_order`)
    expect(cats).toEqual([
      {
        name: 'FOOD',
        question: 'How did your food make you feel?',
        icon: 'utensils',
        display_order: 1,
      },
      {
        name: 'SERVICE',
        question: 'How was the service you received?',
        icon: 'concierge-bell',
        display_order: 2,
      },
      {
        name: 'HOSPITALITY',
        question: 'How did our team make you feel?',
        icon: 'heart-handshake',
        display_order: 3,
      },
      {
        name: 'AMBIENCE',
        question: 'How did you find the ambience & cleanliness?',
        icon: 'sparkles',
        display_order: 4,
      },
    ])
    await db.close()
  })

  it('seeds the five-face scale with the approved colour ramp', async () => {
    const db = await seededDb()
    const scale = await rows<{ value: number; face_key: string; label: string; colour: string }>(
      db,
      `select value, face_key, label, colour from rating_scale order by value`,
    )
    expect(scale).toEqual([
      { value: 1, face_key: 'angry', label: 'Very Poor', colour: '#E63329' },
      { value: 2, face_key: 'sad', label: 'Poor', colour: '#F07829' },
      { value: 3, face_key: 'neutral', label: 'Okay', colour: '#F5C518' },
      { value: 4, face_key: 'happy', label: 'Good', colour: '#8DC63F' },
      { value: 5, face_key: 'delighted', label: 'Excellent', colour: '#39B54A' },
    ])
    await db.close()
  })

  it('seeds 7 negative and 5 positive chips', async () => {
    const db = await seededDb()
    const negative = await rows<{ name: string }>(
      db,
      `select name from issues where kind = 'negative' order by display_order`,
    )
    const positive = await rows<{ name: string }>(
      db,
      `select name from issues where kind = 'positive' order by display_order`,
    )
    expect(negative.map((r) => r.name)).toEqual([
      'Food',
      'Service',
      'Staff',
      'Waiting Time',
      'Cleanliness',
      'Billing',
      'Ambience',
    ])
    expect(positive.map((r) => r.name)).toEqual([
      'Food',
      'Service',
      'Our Team',
      'Ambience',
      'The Experience',
    ])
    await db.close()
  })

  it('seeds the theme lexicon as rows, not code', async () => {
    const db = await seededDb()
    const themes = await one<{ count: string }>(db, `select count(*)::text as count from themes`)
    const keywords = await one<{ count: string }>(
      db,
      `select count(*)::text as count from theme_keywords`,
    )
    expect(Number(themes.count)).toBeGreaterThanOrEqual(12)
    expect(Number(keywords.count)).toBeGreaterThanOrEqual(50)

    // Every theme must have at least one keyword or it can never match.
    const orphans = await rows<{ name: string }>(
      db,
      `select t.name from themes t
       left join theme_keywords k on k.theme_id = t.theme_id
       group by t.name having count(k.keyword_id) = 0`,
    )
    expect(orphans).toEqual([])
    await db.close()
  })
})

describe('0002 — configuration', () => {
  it('ships the wallet reward OFF (§12)', async () => {
    const db = await seededDb()
    const row = await one<{ value: boolean }>(
      db,
      `select (value)::text::boolean as value from app_config where key = 'rewards.enabled'`,
    )
    expect(row.value).toBe(false)

    // The keys must exist so the branch point can be switched on later.
    const keys = await rows<{ key: string }>(
      db,
      `select key from app_config where section = 'rewards' order by key`,
    )
    expect(keys.map((r) => r.key)).toEqual([
      'rewards.amount',
      'rewards.enabled',
      'rewards.wallet_provider',
    ])
    await db.close()
  })

  it('scopes every seeded row to the AIC outlet — no global rows', async () => {
    const db = await seededDb()
    const outlet = await outletId(db)

    for (const table of ['categories', 'issues', 'rating_scale', 'themes', 'app_config']) {
      const strays = await one<{ count: string }>(
        db,
        `select count(*)::text as count from ${table} where outlet_id <> $1`,
        [outlet],
      )
      expect(Number(strays.count), `${table} has rows outside the AIC outlet`).toBe(0)
    }
    await db.close()
  })

  it('covers every config section the build depends on', async () => {
    const db = await seededDb()
    const sections = await rows<{ section: string }>(
      db,
      `select distinct section from app_config order by section`,
    )
    const found = sections.map((r) => r.section)
    for (const expected of [
      'alerts',
      'branding',
      'comment',
      'contact',
      'followup',
      'footer',
      'grievance',
      'kiosk',
      'negative',
      'positive',
      'privacy',
      'rate',
      'rewards',
      'thanks',
      'thresholds',
      'welcome',
    ]) {
      expect(found, `missing config section ${expected}`).toContain(expected)
    }
    await db.close()
  })
})
