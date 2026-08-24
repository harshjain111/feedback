import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAnonClient } from '@/lib/supabase/anon'

/**
 * PATCH /api/feedback/memory — record what the Memory Print Module did.
 *
 * Deliberately NOT part of POST /api/feedback, and deliberately not using its
 * client. That endpoint runs as the service role because it has to create
 * guests and insert feedback; handing those privileges to a request whose whole
 * job is setting three booleans is how a narrow write becomes a wide hole. A
 * bug in the photo layer would have the blast radius of the entire feedback
 * table (CLAUDE.md §12).
 *
 * So this runs as `anon`, which has exactly one privilege on `feedback`:
 * EXECUTE on aic_record_memory (migration 0015). No SELECT, no UPDATE, not even
 * on one column. The three columns are named inside the function body, so
 * "which columns" is code rather than a privilege that can drift.
 *
 * Row scoping is by submission_id — the uuid the kiosk minted for its own draft.
 * `anon` cannot read `feedback` at all, so there is no way to enumerate one; it
 * works as a capability the guest's own session holds.
 *
 * NOTHING ABOUT THE PHOTOGRAPH IS ACCEPTED HERE. No image, no dimensions, no
 * caption. If a field for one ever seems necessary, the design has gone wrong.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const patchSchema = z
  .object({
    submissionId: z.string().uuid(),
    offered: z.boolean().optional(),
    printed: z.boolean().optional(),
    // Capped to match the CHECK constraint, so a bad value is a 400 here rather
    // than a 500 from Postgres.
    retries: z.number().int().min(0).max(10).optional(),
  })
  .strict()

export async function PATCH(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { submissionId, offered, printed, retries } = parsed.data

  if (offered === undefined && printed === undefined && retries === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // null means "leave alone" — the function COALESCEs, so reporting `printed`
  // later cannot blank the `offered` recorded when the screen was shown.
  const client = createAnonClient()
  const { error } = await client.rpc('aic_record_memory', {
    p_submission_id: submissionId,
    p_offered: offered ?? null,
    p_printed: printed ?? null,
    p_retries: retries ?? null,
  })

  if (error) {
    // Logged, not surfaced. Uptake analytics are worth having and worth nothing
    // compared to the guest's journey continuing (§7).
    console.error('[memory] uptake write failed:', error.message)
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  return NextResponse.json({ ok: true })
}
