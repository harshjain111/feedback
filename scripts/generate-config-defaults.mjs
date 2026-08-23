/**
 * Generates lib/config.defaults.ts from supabase/migrations/0002_seed.sql.
 *
 * getConfig() needs a compiled-in fallback so one missing app_config row cannot
 * blank out a kiosk screen. Typing those defaults by hand would put customer-
 * facing copy in the codebase, which §3 forbids and which would silently drift
 * from the seed. So they are generated: the seed migration stays the single
 * source of truth, and `pnpm gen:config` re-derives the fallback from it.
 *
 * tests/config-defaults.test.ts fails if this file is stale.
 */
import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')
const OUT = join(process.cwd(), 'lib', 'config.defaults.ts')

const SUPABASE_STUB = `
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid; $$;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;
`

async function main() {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)

  const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    await db.exec(await readFile(join(MIGRATIONS, file), 'utf8'))
  }

  const { rows } = await db.query(`
    select section, key, value
    from app_config
    order by section, key
  `)

  /** Nest "welcome.h1" into { welcome: { h1: ... } }. */
  const tree = {}
  for (const row of rows) {
    const [section, ...rest] = row.key.split('.')
    const leaf = rest.join('.')
    if (!leaf) throw new Error(`config key "${row.key}" has no section prefix`)
    tree[section] ??= {}
    tree[section][leaf] = row.value
  }

  const body = JSON.stringify(tree, null, 2)
    .split('\n')
    .map((line, i) => (i === 0 ? line : '  ' + line))
    .join('\n')

  const out = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Fallback values for getConfig(), derived from supabase/migrations/0002_seed.sql.
 * Regenerate with:  pnpm gen:config
 *
 * These are a safety net, not the source of truth. The database is authoritative
 * and the CMS is the only place copy may be changed (§3).
 */
import type { AppConfig } from './config.types'

export const CONFIG_DEFAULTS: AppConfig = ${body} as const satisfies AppConfig
`

  await writeFile(OUT, out, 'utf8')

  await writeReferenceDefaults(db)
  await db.close()

  console.log(
    `lib/config.defaults.ts: ${rows.length} keys across ${Object.keys(tree).length} sections`,
  )
}

/**
 * Also emit lib/reference.defaults.ts — the seeded categories, rating scale,
 * issue chips and theme lexicon.
 *
 * Same reasoning as the config fallback, plus one more: it lets the kiosk render
 * and be clicked through in local development before a Supabase project exists,
 * which is how the Prompt 10 and 17 checkpoints get reviewed at all. The loaders
 * only reach for it when Supabase is unconfigured AND NODE_ENV is not
 * production — a missing key in production must still fail loudly.
 *
 * IDs are synthetic and prefixed `offline-` so a stray one is obvious in a log
 * and so regenerating does not churn the file with fresh uuids.
 */
async function writeReferenceDefaults(db) {
  const slug = (value) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

  const { rows: categories } = await db.query(
    `select name, question, icon, display_order from categories where active order by display_order`,
  )
  const { rows: scale } = await db.query(
    `select value, face_key, label, colour from rating_scale where active order by value`,
  )
  const { rows: issues } = await db.query(
    `select name, icon, kind, display_order from issues where active order by kind, display_order`,
  )
  const { rows: themes } = await db.query(
    `select t.name, t.kind, t.display_order,
            array_agg(k.keyword order by k.keyword) filter (where k.active) as keywords
     from themes t
     left join theme_keywords k on k.theme_id = t.theme_id
     where t.active
     group by t.name, t.kind, t.display_order
     order by t.kind, t.display_order`,
  )

  const payload = {
    categories: categories.map((c) => ({ category_id: `offline-category-${slug(c.name)}`, ...c })),
    ratingScale: scale.map((s) => ({ scale_id: `offline-scale-${s.value}`, ...s })),
    issues: issues.map((i) => ({ issue_id: `offline-issue-${i.kind}-${slug(i.name)}`, ...i })),
    themes: themes.map((t) => ({
      theme_id: `offline-theme-${t.kind}-${slug(t.name)}`,
      name: t.name,
      kind: t.kind,
      display_order: t.display_order,
      keywords: t.keywords ?? [],
    })),
  }

  const file = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * The seeded reference rows, derived from supabase/migrations/0002_seed.sql.
 * Regenerate with:  pnpm gen:config
 *
 * Used only when Supabase is unconfigured outside production, so the kiosk can
 * be rendered and reviewed locally. The database is always authoritative.
 */
import type { Category, Issue, RatingFace, Theme } from './config.types'

export const REFERENCE_DEFAULTS: {
  categories: Category[]
  ratingScale: RatingFace[]
  issues: Issue[]
  themes: Theme[]
} = ${JSON.stringify(payload, null, 2)}
`

  await writeFile(join(process.cwd(), 'lib', 'reference.defaults.ts'), file, 'utf8')
  console.log(
    `lib/reference.defaults.ts: ${payload.categories.length} categories, ${payload.ratingScale.length} faces, ${payload.issues.length} chips, ${payload.themes.length} themes`,
  )
}

await main()
