/**
 * Regression tests for a bug that shipped past the original suite.
 *
 * The trigger tests in 0001 ran as the table owner, where RLS does not apply,
 * so they proved the triggers' LOGIC but never their PRIVILEGES. Against a real
 * database the follow-up status mirror ran as the invoking manager, hit
 * `feedback` — which has no UPDATE policy for anyone — and silently updated
 * zero rows. The feedback list then showed a status that disagreed with the
 * follow-up it mirrors.
 *
 * Everything here runs as `authenticated`, which is the only way to catch it.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { asServiceRole, asUser, freshDb, isDenied, one, outletId, type Db } from './harness'

type Ctx = { db: Db; outlet: string; manager: string; feedbackId: string; followUpId: string }
let ctx: Ctx

beforeEach(async () => {
  const db = await freshDb()
  const outlet = await outletId(db)

  const auth = await one<{ id: string }>(
    db,
    `insert into auth.users (email) values ('manager@aic.test') returning id`,
  )
  await db.query(
    `insert into app_users (user_id, outlet_id, name, email, role)
     values ($1, $2, 'Manager', 'manager@aic.test', 'MANAGER')`,
    [auth.id, outlet],
  )

  const guest = await one<{ guest_id: string }>(
    db,
    `insert into guests (outlet_id, phone) values ($1, '9876543210') returning guest_id`,
    [outlet],
  )
  const feedback = await one<{ feedback_id: string }>(
    db,
    `insert into feedback (outlet_id, guest_id, overall_score, follow_up_requested)
     values ($1, $2, 2.00, true) returning feedback_id`,
    [outlet, guest.guest_id],
  )
  const followUp = await one<{ follow_up_id: string }>(
    db,
    `insert into follow_ups (outlet_id, feedback_id, guest_id) values ($1, $2, $3)
     returning follow_up_id`,
    [outlet, feedback.feedback_id, guest.guest_id],
  )

  ctx = {
    db,
    outlet,
    manager: auth.id,
    feedbackId: feedback.feedback_id,
    followUpId: followUp.follow_up_id,
  }
})

describe('status mirror runs with the privileges it needs', () => {
  it('mirrors onto feedback.status when a MANAGER moves the follow-up', async () => {
    await asUser(ctx.db, ctx.manager)

    const result = await ctx.db.query(
      `update follow_ups set status = 'CONTACTED' where follow_up_id = $1`,
      [ctx.followUpId],
    )
    expect(result.affectedRows, 'the manager should be able to update their outlet').toBe(1)

    await asServiceRole(ctx.db)
    const feedback = await one<{ status: string }>(
      ctx.db,
      `select status from feedback where feedback_id = $1`,
      [ctx.feedbackId],
    )
    // The whole point: this was OPEN before the fix, because the mirror's write
    // was blocked by RLS and failed quietly.
    expect(feedback.status).toBe('CONTACTED')

    await ctx.db.close()
  })

  it('keeps mirroring through the whole workflow', async () => {
    await asUser(ctx.db, ctx.manager)

    for (const status of ['CONTACTED', 'RESOLVED', 'CLOSED']) {
      await ctx.db.query(`update follow_ups set status = $2 where follow_up_id = $1`, [
        ctx.followUpId,
        status,
      ])

      await asServiceRole(ctx.db)
      const feedback = await one<{ status: string }>(
        ctx.db,
        `select status from feedback where feedback_id = $1`,
        [ctx.feedbackId],
      )
      expect(feedback.status, `after moving to ${status}`).toBe(status)
      await asUser(ctx.db, ctx.manager)
    }

    await ctx.db.close()
  })

  it('still refuses a direct write to feedback.status by an authenticated user', async () => {
    await asUser(ctx.db, ctx.manager)

    // Denied at the GRANT level, before RLS is even consulted — `authenticated`
    // holds SELECT on feedback and nothing else. Stronger than a policy that
    // matches no rows, and the reason the mirror had to become SECURITY DEFINER
    // rather than being handed an UPDATE policy.
    const denied = await isDenied(
      ctx.db.query(`update feedback set status = 'CLOSED' where feedback_id = $1`, [
        ctx.feedbackId,
      ]),
    )
    expect(denied).toBe(true)

    await asServiceRole(ctx.db)
    const feedback = await one<{ status: string }>(
      ctx.db,
      `select status from feedback where feedback_id = $1`,
      [ctx.feedbackId],
    )
    expect(feedback.status).toBe('OPEN')
    await ctx.db.close()
  })
})

describe('guest aggregates run with the privileges they need', () => {
  it('recomputes when the service role writes a second feedback', async () => {
    await asServiceRole(ctx.db)
    const guest = await one<{ guest_id: string }>(ctx.db, `select guest_id from guests limit 1`)

    await ctx.db.query(
      `insert into feedback (outlet_id, guest_id, overall_score) values ($1, $2, 4.00)`,
      [ctx.outlet, guest.guest_id],
    )

    const after = await one<{ total_feedbacks: number; average_rating: string }>(
      ctx.db,
      `select total_feedbacks, average_rating from guests where guest_id = $1`,
      [guest.guest_id],
    )
    expect(after.total_feedbacks).toBe(2)
    expect(Number(after.average_rating)).toBeCloseTo(3, 2)
    await ctx.db.close()
  })
})
