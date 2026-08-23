import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppConfig } from '@/lib/config.types'
import type { Database } from '@/types/database'
import { toLocalDate } from '@/lib/time'

/**
 * Real-time alerts — CLAUDE.md §27.
 *
 * Evaluated on write, so the manager finds out while the guest is still in the
 * building. Every alert carries a `dedupe_key`, and 0001 has a partial unique
 * index on (outlet_id, dedupe_key) WHERE acknowledged_at IS NULL — so "one live
 * condition, one row" is enforced by the database, not by hoping the evaluator
 * checked first. A re-fire inside the cooldown bumps last_fired_at and refreshes
 * the payload; acknowledging frees the key to fire again.
 *
 * Every threshold comes from config.alerts.
 */

type Db = SupabaseClient<Database>

export type AlertDraft = {
  type: string
  severity: 'info' | 'warning' | 'critical'
  dedupeKey: string
  title: string
  body?: string
  payload?: Record<string, unknown>
}

/**
 * Insert, or refresh the open row for the same condition.
 *
 * Deliberately not an upsert on the primary key: the identity of an alert is
 * its live condition, not its id, and the partial index is what expresses that.
 */
export async function raise(
  db: Db,
  outletId: string,
  draft: AlertDraft,
  cooldownMinutes: number,
): Promise<'created' | 'refreshed' | 'suppressed'> {
  const now = new Date()
  const cooldownUntil = new Date(now.getTime() + cooldownMinutes * 60_000).toISOString()

  const { data: open } = await db
    .from('alerts')
    .select('alert_id, cooldown_until')
    .eq('outlet_id', outletId)
    .eq('dedupe_key', draft.dedupeKey)
    .is('acknowledged_at', null)
    .maybeSingle()

  if (open) {
    await db
      .from('alerts')
      .update({
        last_fired_at: now.toISOString(),
        cooldown_until: cooldownUntil,
        severity: draft.severity,
        title: draft.title,
        body: draft.body ?? null,
        payload: (draft.payload ?? {}) as never,
      })
      .eq('alert_id', open.alert_id)

    // Inside the cooldown the manager has already been told; the row is kept
    // current but nothing new is surfaced.
    const inCooldown = open.cooldown_until !== null && new Date(open.cooldown_until) > now
    return inCooldown ? 'suppressed' : 'refreshed'
  }

  const { error } = await db.from('alerts').insert({
    outlet_id: outletId,
    type: draft.type,
    severity: draft.severity,
    dedupe_key: draft.dedupeKey,
    title: draft.title,
    body: draft.body ?? null,
    payload: (draft.payload ?? {}) as never,
    cooldown_until: cooldownUntil,
  })

  // 23505: another request won the race on the partial unique index. That
  // request has already told the manager, so there is nothing left to do.
  if (error && error.code !== '23505') throw error
  return error ? 'suppressed' : 'created'
}

type EvaluationInput = {
  db: Db
  outletId: string
  feedbackId: string
  config: AppConfig
  ratings: { categoryId: string; categoryName: string; rating: number }[]
  followUpRequested: boolean
  guestName: string | null
}

/**
 * Run every §27 rule against a newly written feedback.
 *
 * Failures are swallowed and logged: a broken alert rule must never cost a
 * guest their submission. The feedback row is already committed by this point.
 */
export async function evaluateAlerts(input: EvaluationInput): Promise<void> {
  const { db, outletId, config } = input
  const cooldown = config.alerts.cooldown_minutes

  try {
    const lowRatings = input.ratings.filter(
      (rating) => rating.rating <= config.alerts.rating_at_or_below,
    )

    // 1 — a single very low rating
    for (const rating of lowRatings) {
      await raise(
        db,
        outletId,
        {
          type: 'LOW_RATING',
          severity: 'warning',
          // Scoped to the category and the day: the same category scoring badly
          // again this afternoon is the same story, not a second one.
          dedupeKey: `LOW_RATING:${rating.categoryId}:${toLocalDate()}`,
          title: `${rating.categoryName} was rated ${rating.rating} out of 5`,
          body: 'A guest rated this at or below the alert threshold.',
          payload: { feedbackId: input.feedbackId, categoryId: rating.categoryId },
        },
        cooldown,
      )
    }

    // 2 — the guest asked to be contacted
    if (input.followUpRequested && config.alerts.on_follow_up_requested) {
      await raise(
        db,
        outletId,
        {
          type: 'FOLLOW_UP_REQUESTED',
          severity: 'critical',
          // Per feedback: every request is its own commitment to a person.
          dedupeKey: `FOLLOW_UP_REQUESTED:${input.feedbackId}`,
          title: input.guestName
            ? `${input.guestName} asked to be contacted`
            : 'A guest asked to be contacted',
          body: 'Open the feedback to assign it.',
          payload: { feedbackId: input.feedbackId },
        },
        cooldown,
      )
    }

    // 3 — several low ratings on one category inside the window
    if (lowRatings.length > 0) {
      await evaluateClusters(input)
    }
  } catch (error) {
    console.error('[alerts] evaluation failed:', error)
  }
}

async function evaluateClusters(input: EvaluationInput): Promise<void> {
  const { db, outletId, config } = input
  const windowStart = new Date(Date.now() - config.alerts.cluster_window_minutes * 60_000)

  const { data } = await db
    .from('v_rating_facts')
    .select('feedback_id, category_id, rating')
    .eq('outlet_id', outletId)
    .lte('rating', config.alerts.rating_at_or_below)
    .gte('local_date', toLocalDate(windowStart))

  if (!data) return

  // Recent low ratings only. The view carries local_date, not a timestamp, so
  // the date filter is a coarse pre-filter and the precise window is applied by
  // joining back to submitted_at below.
  const recent = await db
    .from('feedback')
    .select('feedback_id')
    .eq('outlet_id', outletId)
    .gte('submitted_at', windowStart.toISOString())

  const inWindow = new Set((recent.data ?? []).map((row) => row.feedback_id))

  const byCategory = new Map<string, Set<string>>()
  for (const fact of data) {
    if (!fact.category_id || !fact.feedback_id) continue
    if (!inWindow.has(fact.feedback_id)) continue
    const set = byCategory.get(fact.category_id) ?? new Set<string>()
    set.add(fact.feedback_id)
    byCategory.set(fact.category_id, set)
  }

  for (const [categoryId, feedbacks] of byCategory) {
    if (feedbacks.size < config.alerts.cluster_count) continue

    const name =
      input.ratings.find((rating) => rating.categoryId === categoryId)?.categoryName ?? 'a category'

    await raise(
      db,
      outletId,
      {
        type: 'LOW_RATING_CLUSTER',
        severity: 'critical',
        // Bucketed by the hour so a rolling window cannot re-fire every minute.
        dedupeKey: `LOW_RATING_CLUSTER:${categoryId}:${new Date().toISOString().slice(0, 13)}`,
        title: `${feedbacks.size} guests rated ${name} ${config.alerts.rating_at_or_below} or below in the last ${config.alerts.cluster_window_minutes} minutes`,
        body: 'Something is going wrong right now.',
        payload: { categoryId, count: feedbacks.size },
      },
      config.alerts.cooldown_minutes,
    )
  }
}
