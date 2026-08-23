/**
 * Generates types/database.ts from supabase/migrations/.
 *
 * `supabase gen types typescript` needs a running project or the Supabase CLI,
 * neither of which exists on this machine yet. This does the same job the same
 * way — introspect a real Postgres that has the migrations applied — using the
 * PGlite instance the DB tests already run against. Output shape matches the
 * Supabase generator so swapping back to the CLI later is a drop-in.
 *
 * Run after every migration:  pnpm gen:types
 */
import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')
const OUT = join(process.cwd(), 'types', 'database.ts')

const SUPABASE_STUB = `
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid; $$;
  create or replace function auth.role() returns text language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon'); $$;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;
`

/** Postgres type → TypeScript type. */
function tsType(udt) {
  switch (udt) {
    case 'bool':
      return 'boolean'
    case 'int2':
    case 'int4':
    case 'int8':
    case 'float4':
    case 'float8':
    case 'numeric':
      return 'number'
    case 'json':
    case 'jsonb':
      return 'Json'
    default:
      // uuid, text, date, time, timestamptz, bigserial and friends all arrive
      // as strings over PostgREST.
      return 'string'
  }
}

function emitRelationships(fks) {
  if (fks.length === 0) return ''
  const entries = fks.map(
    (fk) => `
          {
            foreignKeyName: '${fk.constraint_name}'
            columns: [${fk.columns.map((c) => `'${c}'`).join(', ')}]
            isOneToOne: ${fk.is_one_to_one}
            referencedRelation: '${fk.referenced_relation}'
            referencedColumns: [${fk.referenced_columns.map((c) => `'${c}'`).join(', ')}]
          },`,
  )
  return `${entries.join('')}
        `
}

async function main() {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)

  const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    await db.exec(await readFile(join(MIGRATIONS, file), 'utf8'))
  }

  const { rows: columns } = await db.query(`
    select c.table_name,
           c.column_name,
           c.udt_name,
           c.is_nullable = 'YES'          as nullable,
           c.column_default is not null   as has_default,
           t.table_type
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
    order by c.table_name, c.ordinal_position
  `)

  // Columns a BEFORE INSERT trigger fills in. They have no column default, so
  // introspection cannot know they are optional — but requiring them in an
  // Insert type would be wrong.
  const TRIGGER_FILLED = {
    feedback: ['feedback_code', 'local_date', 'local_time', 'day_of_week', 'hour_bucket'],
    guests: ['guest_code'],
  }

  const tables = new Map()
  const views = new Map()
  for (const col of columns) {
    const target = col.table_type === 'VIEW' ? views : tables
    if (!target.has(col.table_name)) target.set(col.table_name, [])
    target.get(col.table_name).push(col)
  }

  // Foreign keys, so PostgREST embedded selects (`themes(theme_keywords(...))`)
  // typecheck. Without these the Relationships arrays are empty and every join
  // resolves to SelectQueryError.
  const { rows: fkeys } = await db.query(`
    select
      con.conname                                    as constraint_name,
      src.relname                                    as table_name,
      tgt.relname                                    as referenced_relation,
      array(
        select a.attname from unnest(con.conkey) k
        join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k
      )                                              as columns,
      array(
        select a.attname from unnest(con.confkey) k
        join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k
      )                                              as referenced_columns,
      exists (
        select 1 from pg_index i
        where i.indrelid = con.conrelid
          and i.indisunique
          and i.indkey::int2[] @> con.conkey
          and con.conkey @> i.indkey::int2[]
      )                                              as is_one_to_one
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_class tgt on tgt.oid = con.confrelid
    join pg_namespace n on n.oid = src.relnamespace
    where con.contype = 'f' and n.nspname = 'public'
    order by src.relname, con.conname
  `)

  const relationships = new Map()
  for (const fk of fkeys) {
    if (!relationships.has(fk.table_name)) relationships.set(fk.table_name, [])
    relationships.get(fk.table_name).push(fk)
  }

  const { rows: functions } = await db.query(`
    select p.proname as name,
           pg_get_function_arguments(p.oid) as args,
           pg_get_function_result(p.oid)    as result
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
    order by p.proname
  `)

  const out = []
  out.push('/**')
  out.push(' * GENERATED FILE — do not edit by hand.')
  out.push(' *')
  out.push(' * Regenerate after every migration (CLAUDE.md §13.2):')
  out.push(' *   pnpm gen:types')
  out.push(' *')
  out.push(' * Produced by scripts/generate-database-types.mjs, which applies')
  out.push(' * supabase/migrations/ to a real Postgres and introspects the result.')
  out.push(' */')
  out.push('')
  out.push(
    'export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]',
  )
  out.push('')
  out.push('export type Database = {')
  out.push('  public: {')

  // ---- Tables ----
  out.push('    Tables: {')
  for (const [table, cols] of [...tables].sort()) {
    const triggerFilled = TRIGGER_FILLED[table] ?? []
    out.push(`      ${table}: {`)

    out.push('        Row: {')
    for (const c of cols) {
      out.push(`          ${c.column_name}: ${tsType(c.udt_name)}${c.nullable ? ' | null' : ''}`)
    }
    out.push('        }')

    out.push('        Insert: {')
    for (const c of cols) {
      const optional = c.nullable || c.has_default || triggerFilled.includes(c.column_name)
      out.push(
        `          ${c.column_name}${optional ? '?' : ''}: ${tsType(c.udt_name)}${
          c.nullable ? ' | null' : ''
        }`,
      )
    }
    out.push('        }')

    out.push('        Update: {')
    for (const c of cols) {
      out.push(`          ${c.column_name}?: ${tsType(c.udt_name)}${c.nullable ? ' | null' : ''}`)
    }
    out.push('        }')
    out.push(`        Relationships: [${emitRelationships(relationships.get(table) ?? [])}]`)
    out.push('      }')
  }
  out.push('    }')

  // ---- Views ----
  out.push('    Views: {')
  for (const [view, cols] of [...views].sort()) {
    out.push(`      ${view}: {`)
    out.push('        Row: {')
    for (const c of cols) {
      out.push(`          ${c.column_name}: ${tsType(c.udt_name)}${c.nullable ? ' | null' : ''}`)
    }
    out.push('        }')
    out.push('        Relationships: []')
    out.push('      }')
  }
  out.push('    }')

  // ---- Functions (names + shapes as comments; RPC args stay untyped) ----
  out.push('    Functions: {')
  for (const fn of functions) {
    out.push(`      /** ${fn.name}(${fn.args}) -> ${fn.result} */`)
    out.push(`      ${fn.name}: {`)
    out.push('        Args: Record<string, unknown>')
    out.push(`        Returns: unknown`)
    out.push('      }')
  }
  out.push('    }')

  out.push('    Enums: Record<string, never>')
  out.push('    CompositeTypes: Record<string, never>')
  out.push('  }')
  out.push('}')
  out.push('')

  // ---- Convenience aliases ----
  out.push('export type Tables<T extends keyof Database["public"]["Tables"]> =')
  out.push('  Database["public"]["Tables"][T]["Row"]')
  out.push('export type TablesInsert<T extends keyof Database["public"]["Tables"]> =')
  out.push('  Database["public"]["Tables"][T]["Insert"]')
  out.push('export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =')
  out.push('  Database["public"]["Tables"][T]["Update"]')
  out.push('export type Views<T extends keyof Database["public"]["Views"]> =')
  out.push('  Database["public"]["Views"][T]["Row"]')
  out.push('')

  await writeFile(OUT, out.join('\n'), 'utf8')
  await db.close()

  console.log(
    `types/database.ts: ${tables.size} tables, ${views.size} views, ${functions.length} functions`,
  )
}

await main()
