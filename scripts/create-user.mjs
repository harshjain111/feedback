/**
 * Creates an admin-app user: a Supabase Auth account plus its `app_users` row.
 *
 * Both halves are required. lib/auth.ts treats an auth account with no
 * app_users row as signed out, on purpose — having an account and having access
 * are different things (§8).
 *
 *   pnpm create-user <email> <role> [name] [password]
 *
 * Role is one of OWNER, ADMIN, MANAGER, STAFF. Omit the password and a strong
 * one is generated and printed once.
 */
import { readFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'STAFF']

async function loadEnv() {
  const text = await readFile('.env.local', 'utf8')
  for (const line of text.split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

function generatePassword() {
  // No ambiguous glyphs: this gets read off a screen and typed by a person.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  return [...randomBytes(18)].map((byte) => alphabet[byte % alphabet.length]).join('')
}

async function main() {
  await loadEnv()

  const [email, roleArg, nameArg, passwordArg] = process.argv.slice(2)
  if (!email || !roleArg) {
    console.error('Usage: pnpm create-user <email> <OWNER|ADMIN|MANAGER|STAFF> [name] [password]')
    process.exit(1)
  }

  const role = roleArg.toUpperCase()
  if (!ROLES.includes(role)) {
    console.error(`Unknown role "${roleArg}". One of: ${ROLES.join(', ')}`)
    process.exit(1)
  }

  const name = nameArg || email.split('@')[0]
  const password = passwordArg || generatePassword()
  const generated = !passwordArg

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const outletCode = process.env.NEXT_PUBLIC_OUTLET_CODE || 'AIC'
  const { data: outlet, error: outletError } = await db
    .from('outlets')
    .select('outlet_id')
    .eq('code', outletCode)
    .single()

  if (outletError || !outlet) {
    console.error(`No outlet with code ${outletCode}. Run pnpm migrate first.`)
    process.exit(1)
  }

  // Reuse the auth account if it already exists, so re-running only fixes up
  // the app_users row rather than failing outright.
  let userId
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError) {
    if (!/already been registered|already exists/i.test(createError.message)) {
      console.error(`Could not create the auth account: ${createError.message}`)
      process.exit(1)
    }
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existing = list?.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
    if (!existing) {
      console.error('Account exists but could not be found. Check the Supabase dashboard.')
      process.exit(1)
    }
    userId = existing.id
    if (passwordArg) await db.auth.admin.updateUserById(userId, { password })
    console.log(`auth account already existed — reusing ${userId}`)
  } else {
    userId = created.user.id
    console.log(`auth account created  ${userId}`)
  }

  const { error: rowError } = await db
    .from('app_users')
    .upsert(
      { user_id: userId, outlet_id: outlet.outlet_id, name, email, role, active: true },
      { onConflict: 'user_id' },
    )

  if (rowError) {
    console.error(`Could not write the app_users row: ${rowError.message}`)
    process.exit(1)
  }

  console.log(`app_users row written  ${role}  ${name} <${email}>`)
  if (generated) {
    console.log(`\n  password: ${password}`)
    console.log('  Shown once. Change it after signing in.\n')
  }
}

await main()
