/**
 * In-memory Postgres for migration tests.
 *
 * There is no Supabase project wired up yet and no local Postgres on this
 * machine, so the migrations are executed against PGlite (Postgres compiled to
 * WASM) instead of being eyeballed. This catches syntax errors, broken triggers
 * and constraint mistakes at the point they are written.
 *
 * What it does NOT prove: Supabase-specific behaviour. `auth.users`, `auth.uid()`
 * and the `authenticated` / `anon` roles are stubbed below, so RLS policies are
 * exercised for SQL validity and logic, not for real JWT-driven enforcement.
 * That still has to be verified against a real project — see the Phase A notes.
 */
import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')

/** The parts of a Supabase database that our migrations assume already exist. */
const SUPABASE_STUB = `
  create schema if not exists auth;

  create table if not exists auth.users (
    id    uuid primary key default gen_random_uuid(),
    email text
  );

  -- Overridden per-test to impersonate a signed-in user.
  create or replace function auth.uid() returns uuid
  language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  create or replace function auth.role() returns text
  language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
  $$;

  do $$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then
      create role service_role nologin bypassrls;
    end if;
  end
  $$;
`

export type Db = PGlite

/** Boot a fresh database and apply every migration in filename order. */
export async function freshDb(upTo?: string): Promise<Db> {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()

  for (const file of files) {
    if (upTo && file > upTo) break
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8')
    try {
      await db.exec(sql)
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`)
    }
  }

  return db
}

/** Convenience: run a query and return typed rows. */
export async function rows<T>(db: Db, sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await db.query<T>(sql, params)
  return result.rows
}

/** Convenience: first row, or throw if the query returned nothing. */
export async function one<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const [row] = await rows<T>(db, sql, params)
  if (!row) throw new Error(`Expected one row from: ${sql}`)
  return row
}

/**
 * Impersonate a signed-in app user for the rest of the session.
 *
 * Sets the JWT claim our auth.uid() stub reads, then drops to the
 * `authenticated` database role so RLS actually applies — as the owning role,
 * policies would be bypassed and every test would pass for the wrong reason.
 */
export async function asUser(db: Db, userId: string): Promise<void> {
  await db.exec(`reset role;`)
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false);`)
  await db.exec(`select set_config('request.jwt.claim.role', 'authenticated', false);`)
  await db.exec(`set role authenticated;`)
}

/** Become the anonymous kiosk visitor. */
export async function asAnon(db: Db): Promise<void> {
  await db.exec(`reset role;`)
  await db.exec(`select set_config('request.jwt.claim.sub', '', false);`)
  await db.exec(`select set_config('request.jwt.claim.role', 'anon', false);`)
  await db.exec(`set role anon;`)
}

/** Back to the owner — used for fixture setup, and stands in for service_role. */
export async function asServiceRole(db: Db): Promise<void> {
  await db.exec(`reset role;`)
  await db.exec(`select set_config('request.jwt.claim.sub', '', false);`)
}

/** True when the statement was refused (either by a policy or by a grant). */
export async function isDenied(promise: Promise<unknown>): Promise<boolean> {
  try {
    await promise
    return false
  } catch {
    return true
  }
}

/** The seeded outlet, which almost every test needs. */
export async function outletId(db: Db): Promise<string> {
  const row = await one<{ outlet_id: string }>(
    db,
    `select outlet_id from outlets where code = 'AIC'`,
  )
  return row.outlet_id
}
