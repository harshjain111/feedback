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
  await db.close()

  console.log(
    `lib/config.defaults.ts: ${rows.length} keys across ${Object.keys(tree).length} sections`,
  )
}

await main()
