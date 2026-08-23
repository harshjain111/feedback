/**
 * Applies supabase/migrations/ to the project database, in order, once each.
 *
 * The Supabase CLI is not installed on this machine, so this is the migration
 * runner. It keeps its own ledger table (`schema_migrations`) so re-running is
 * safe: already-applied files are skipped, and each file runs inside a
 * transaction so a failure leaves nothing half-applied.
 *
 *   pnpm migrate           apply pending migrations
 *   pnpm migrate --status  list what is applied and what is pending
 */
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import pg from 'pg'

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')

function connectionString() {
  const url = process.env.SUPABASE_DB_URL
  if (!url) {
    throw new Error('SUPABASE_DB_URL is not set. Add it to .env.local.')
  }
  return url
}

async function loadEnv() {
  // Deliberately not dotenv: one file, three lines of parsing, no dependency.
  try {
    const text = await readFile(join(process.cwd(), '.env.local'), 'utf8')
    for (const line of text.split('\n')) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
    }
  } catch {
    // Falls through to whatever is already in the environment.
  }
}

const LEDGER = `
  create table if not exists schema_migrations (
    filename    text primary key,
    checksum    text not null,
    applied_at  timestamptz not null default now()
  );
`

async function main() {
  await loadEnv()

  const statusOnly = process.argv.includes('--status')
  const client = new pg.Client({
    connectionString: connectionString(),
    ssl: { rejectUnauthorized: false },
    // Supabase's pooler and direct endpoints can both be slow to accept the
    // first connection on a cold project.
    connectionTimeoutMillis: 30_000,
    statement_timeout: 120_000,
  })

  await client.connect()

  try {
    await client.query(LEDGER)

    const { rows: applied } = await client.query(
      'select filename, checksum from schema_migrations order by filename',
    )
    const appliedBy = new Map(applied.map((row) => [row.filename, row.checksum]))

    const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort()

    if (statusOnly) {
      for (const file of files) {
        console.log(`${appliedBy.has(file) ? 'applied ' : 'PENDING '} ${file}`)
      }
      return
    }

    for (const file of files) {
      const sql = await readFile(join(MIGRATIONS, file), 'utf8')
      const checksum = createHash('sha256').update(sql).digest('hex').slice(0, 16)

      const previous = appliedBy.get(file)
      if (previous) {
        // A changed file that is already applied is a real problem: the database
        // and the repo disagree about what the schema is.
        if (previous !== checksum) {
          throw new Error(
            `${file} has changed since it was applied (${previous} -> ${checksum}). ` +
              'Write a new migration instead of editing an applied one.',
          )
        }
        console.log(`skip    ${file}`)
        continue
      }

      process.stdout.write(`apply   ${file} ... `)
      await client.query('begin')
      try {
        await client.query(sql)
        await client.query('insert into schema_migrations (filename, checksum) values ($1, $2)', [
          file,
          checksum,
        ])
        await client.query('commit')
        console.log('ok')
      } catch (error) {
        await client.query('rollback')
        console.log('FAILED')
        throw error
      }
    }
  } finally {
    await client.end()
  }
}

await main()
