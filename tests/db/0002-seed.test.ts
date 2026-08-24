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

/**
 * Sections whose strings are locked copy, minus the keys we authored.
 *
 * `memory` is deliberately absent: PHOTO_MODULE.md §9 is a draft for client
 * approval, not §5 locked copy, so its strings are free to be refined in the
 * CMS without failing this check. It gets its own coverage below.
 */
const LOCKED_SECTIONS = [
  'welcome',
  'rate',
  'negative',
  'positive',
  'comment',
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
  'contact.cta_hint',
  'contact.followup_sub',
  'contact.phone_hint',
  'grievance.name',
  'grievance.phone',
  'grievance.email',
  'negative.chips_hint',
  'comment.h1_short',
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

  it('uses no forbidden escalation language anywhere a guest can read', async () => {
    // The follow-up screen is gone (CLAUDE.md §4) but the rule it carried is
    // not — it was never really about that one screen. Widened to every
    // guest-facing section rather than deleted with the screen, which is how a
    // principle quietly stops being enforced.
    const db = await seededDb()
    const config = await rows<{ value: string }>(
      db,
      `select value #>> '{}' as value from app_config
       where section in ('welcome','rate','negative','positive','comment','contact','thanks')`,
    )
    const joined = config
      .map((r) => r.value)
      .join(' ')
      .toLowerCase()
    for (const banned of ['complaint', 'lodge', 'manager']) {
      expect(joined, `guest-facing copy must not say "${banned}" (§5)`).not.toContain(banned)
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
  it('leaves no trace of the retired follow-up screen', async () => {
    // 0013 deleted it. A row surviving here would resurface as an editable CMS
    // field wired to nothing, and AppConfig has no `followup` member to hold it.
    const db = await seededDb()
    const left = await rows<{ key: string }>(
      db,
      `select key from app_config where section = 'followup' or key like 'followup.%'`,
    )
    expect(left.map((r) => r.key)).toEqual([])
    await db.close()
  })

  it('gives the photo nowhere to be stored (PHOTO_MODULE.md rule 2)', async () => {
    // The load-bearing test of the whole module. Rule 2 is not "we delete it
    // afterwards" — the image must have no path off the device, and the first
    // place that promise gets quietly broken is a column to park one in "for
    // now". So: no column anywhere in the schema may look like it holds image
    // data, and feedback in particular may carry only the three booleans.
    const db = await seededDb()

    const suspicious = await rows<{ table_name: string; column_name: string }>(
      db,
      `select table_name, column_name
       from information_schema.columns
       where table_schema = 'public'
         and (
           column_name ~* '(photo|image|jpeg|jpg|png|snapshot|selfie|capture|thumbnail|avatar)'
           or (data_type = 'bytea')
         )
       order by table_name, column_name`,
    )
    expect(
      suspicious.map((r) => `${r.table_name}.${r.column_name}`),
      'no column may hold, or look like it holds, an image',
    ).toEqual([])

    const memoryColumns = await rows<{ column_name: string }>(
      db,
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'feedback'
         and column_name like 'memory%'
       order by column_name`,
    )
    expect(memoryColumns.map((r) => r.column_name)).toEqual([
      'memory_offered',
      'memory_printed',
      'memory_retries',
    ])

    await db.close()
  })

  it('gives the kiosk no privilege on feedback except one function (CLAUDE.md §12)', async () => {
    // 0014 tried this as a column-level UPDATE grant. Postgres refused the
    // intended write, because an UPDATE needs SELECT on the columns its WHERE
    // clause reads and anon has none on feedback by design (§7). The obvious
    // patch — granting SELECT on submission_id — would have opened exactly the
    // enumeration surface the capability model depends on being closed.
    //
    // 0015 replaced it with a SECURITY DEFINER function, which is strictly
    // narrower: no column privilege at all, and the three columns named in code
    // rather than held as a grant that a later migration could widen.
    const db = await seededDb()

    const granted = await rows<{ column_name: string; privilege_type: string }>(
      db,
      `select column_name, privilege_type
       from information_schema.column_privileges
       where table_schema = 'public' and table_name = 'feedback' and grantee = 'anon'`,
    )
    expect(granted, 'anon must hold no column privilege on feedback').toEqual([])

    const tableGrants = await rows<{ privilege_type: string }>(
      db,
      `select privilege_type from information_schema.table_privileges
       where table_schema = 'public' and table_name = 'feedback' and grantee = 'anon'`,
    )
    expect(tableGrants, 'anon must hold no table privilege on feedback').toEqual([])

    // Exactly one door, and it is EXECUTE on the function.
    const functionGrants = await rows<{ routine_name: string; privilege_type: string }>(
      db,
      `select routine_name, privilege_type from information_schema.routine_privileges
       where routine_schema = 'public' and grantee = 'anon'
       order by routine_name`,
    )
    expect(functionGrants.map((r) => r.routine_name)).toEqual(['aic_record_memory'])
    expect(functionGrants.map((r) => r.privilege_type)).toEqual(['EXECUTE'])

    await db.close()
  })

  it('pins the search_path of the uptake function (§12)', async () => {
    // A SECURITY DEFINER function that resolves table names through the
    // caller's search_path is a privilege-escalation bug, not a convenience.
    const db = await seededDb()
    const fn = await one<{ prosecdef: boolean; proconfig: string | null }>(
      db,
      `select prosecdef, array_to_string(proconfig, ',') as proconfig
       from pg_proc where proname = 'aic_record_memory'`,
    )
    expect(fn.prosecdef).toBe(true)
    expect(fn.proconfig ?? '').toContain('search_path=public')
    await db.close()
  })

  it('seeds the memory module switched on, with all three kill-switch layers', async () => {
    const db = await seededDb()
    const config = await rows<{ key: string; value: string }>(
      db,
      `select key, value::text as value from app_config where section = 'memory' order by key`,
    )
    const byKey = new Map(config.map((r) => [r.key, r.value]))

    // Layer 1 on, layer 2 armed, layer 3 dormant (§8b).
    expect(byKey.get('memory.enabled')).toBe('true')
    expect(byKey.get('memory.auto_disable_on_failure')).toBe('true')
    expect(byKey.get('memory.failure_threshold')).toBe('3')
    expect(byKey.get('memory.schedule_enabled')).toBe('false')

    // Atkinson, not Floyd-Steinberg. §4 is explicit that this is the product's
    // look and not a tuning preference — 3/4 error diffusion stays punchy where
    // full diffusion goes grey on thermal paper.
    expect(byKey.get('memory.pipeline')).toContain('atkinson')

    // The thermal logo must stay empty until a person prepares a 1-bit asset.
    // Defaulting it to the web logo would print a grey smear at 203dpi (§5).
    expect(byKey.get('memory.thermal_logo_url')).toBe('""')

    await db.close()
  })

  it('offers the keepsake in the same breath whatever the rating (§14.3)', async () => {
    // Non-negotiable #3. The negative branch gets a different register, never a
    // lesser gift and never a condition — so neither copy set may hint that the
    // print depends on anything, and both must exist.
    const db = await seededDb()
    const config = await rows<{ key: string; value: string }>(
      db,
      `select key, value #>> '{}' as value from app_config where section = 'memory'`,
    )
    const byKey = new Map(config.map((r) => [r.key, r.value]))

    for (const key of [
      'memory.offer_heading',
      'memory.offer_body',
      'memory.negative_offer_heading',
      'memory.negative_offer_body',
    ]) {
      expect(byKey.get(key), `${key} must be seeded`).toBeTruthy()
    }

    const offerCopy = [
      byKey.get('memory.offer_heading'),
      byKey.get('memory.offer_body'),
      byKey.get('memory.negative_offer_heading'),
      byKey.get('memory.negative_offer_body'),
      byKey.get('memory.take_cta'),
    ]
      .join(' ')
      .toLowerCase()

    // Anything transactional turns a gift into leverage on the rating.
    for (const banned of ['if you', 'in return', 'because you', 'reward', 'earn', 'qualify']) {
      expect(offerCopy, `keepsake copy must not say "${banned}" (§14.3)`).not.toContain(banned)
    }

    await db.close()
  })

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
      'footer',
      'grievance',
      'kiosk',
      'memory',
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
