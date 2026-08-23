import { NextResponse } from 'next/server'
import { extractThemes } from '@/lib/analytics/themes'
import { getCurrentUser } from '@/lib/auth'
import { getThemeLexicon } from '@/lib/config'
import { can } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Re-extract themes across historical comments (§26, Prompt 27).
 *
 * Editing the lexicon in settings changes what future comments match; without
 * this, last month's comments keep whatever they matched under the old keyword
 * list and the trend lines lie about history. Running it is a choice, not an
 * automatic side effect of every save — a manager should be able to add a
 * keyword without silently rewriting the past.
 *
 * Only the comment INDEX is rewritten. feedback.comment is never touched.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BATCH = 500

export async function POST(): Promise<Response> {
  const user = await getCurrentUser()
  if (!can(user, 'manage:cms')) {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 })
  }

  const lexicon = await getThemeLexicon()
  // Service role: this rewrites rows across the whole outlet's history, which
  // no RLS-bound session is allowed to do in bulk.
  const db = createAdminClient()

  let processed = 0
  let matched = 0
  let offset = 0

  for (;;) {
    const { data, error } = await db
      .from('feedback')
      .select('feedback_id, comment')
      .eq('outlet_id', user!.outletId)
      .not('comment', 'is', null)
      .order('feedback_id')
      .range(offset, offset + BATCH - 1)

    if (error) {
      return NextResponse.json({ error: `Backfill failed: ${error.message}` }, { status: 500 })
    }
    if (!data || data.length === 0) break

    for (const row of data) {
      const matches = extractThemes(row.comment, lexicon)

      // Replace rather than merge: a keyword the manager REMOVED must stop
      // counting, which an upsert would never achieve.
      await db.from('feedback_themes').delete().eq('feedback_id', row.feedback_id)

      if (matches.length > 0) {
        await db
          .from('feedback_themes')
          .insert(matches.map((match) => ({ feedback_id: row.feedback_id, ...match })))
        matched += 1
      }
      processed += 1
    }

    if (data.length < BATCH) break
    offset += BATCH
  }

  await db.from('audit_log').insert({
    outlet_id: user!.outletId,
    user_id: user!.userId,
    action: 'THEME_BACKFILL',
    entity: 'feedback_themes',
    after: { processed, matched },
  })

  return NextResponse.json({ processed, matched })
}
