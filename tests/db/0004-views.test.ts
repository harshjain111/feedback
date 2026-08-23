import { beforeEach, describe, expect, it } from 'vitest'
import { asServiceRole, asUser, freshDb, one, outletId, rows, type Db } from './harness'

type Ctx = { db: Db; outlet: string }
let ctx: Ctx

/** Seed a small but realistic week so the rollups have something to roll up. */
async function seedActivity(db: Db, outlet: string) {
  const categories = await rows<{ category_id: string; name: string }>(
    db,
    `select category_id, name from categories order by display_order`,
  )
  const byName = new Map(categories.map((c) => [c.name, c.category_id]))

  const make = async (
    day: string,
    scores: Record<string, number>,
    options: { comment?: string; followUp?: boolean; phone?: string; issue?: string } = {},
  ) => {
    let guestId: string | null = null
    if (options.phone) {
      const existing = await rows<{ guest_id: string }>(
        db,
        `select guest_id from guests where outlet_id = $1 and phone = $2`,
        [outlet, options.phone],
      )
      guestId =
        existing[0]?.guest_id ??
        (
          await one<{ guest_id: string }>(
            db,
            `insert into guests (outlet_id, phone) values ($1, $2) returning guest_id`,
            [outlet, options.phone],
          )
        ).guest_id
    }

    const values = Object.values(scores)
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const sentiment = values.some((v) => v <= 2) ? 'negative' : avg >= 4 ? 'positive' : 'neutral'

    const feedback = await one<{ feedback_id: string }>(
      db,
      `insert into feedback
         (outlet_id, guest_id, submitted_at, local_date, overall_score, sentiment, comment,
          follow_up_requested)
       values ($1, $2, $3::date + time '19:30', $3, $4, $5, $6, $7)
       returning feedback_id`,
      [
        outlet,
        guestId,
        day,
        Math.round(avg * 100) / 100,
        sentiment,
        options.comment ?? null,
        options.followUp ?? false,
      ],
    )

    for (const [name, rating] of Object.entries(scores)) {
      await db.query(
        `insert into feedback_ratings (feedback_id, category_id, rating) values ($1, $2, $3)`,
        [feedback.feedback_id, byName.get(name), rating],
      )
    }

    if (options.issue) {
      const issue = await one<{ issue_id: string }>(
        db,
        `select issue_id from issues where outlet_id = $1 and name = $2 and kind = 'negative'`,
        [outlet, options.issue],
      )
      await db.query(`insert into feedback_issues (feedback_id, issue_id) values ($1, $2)`, [
        feedback.feedback_id,
        issue.issue_id,
      ])
    }

    if (options.followUp) {
      await db.query(
        `insert into follow_ups (outlet_id, feedback_id, guest_id) values ($1, $2, $3)`,
        [outlet, feedback.feedback_id, guestId],
      )
    }

    return feedback.feedback_id
  }

  await make('2026-08-22', { FOOD: 5, SERVICE: 5, HOSPITALITY: 5, AMBIENCE: 4 })
  await make(
    '2026-08-22',
    { FOOD: 4, SERVICE: 4, HOSPITALITY: 4, AMBIENCE: 4 },
    { phone: '9000000001' },
  )

  await make(
    '2026-08-23',
    { FOOD: 5, SERVICE: 1, HOSPITALITY: 4, AMBIENCE: 4 },
    {
      comment: 'We waited far too long',
      followUp: true,
      phone: '9000000001',
      issue: 'Waiting Time',
    },
  )
  await make('2026-08-23', { FOOD: 3, SERVICE: 3, HOSPITALITY: 3, AMBIENCE: 3 })
  await make(
    '2026-08-23',
    { FOOD: 2, SERVICE: 2, HOSPITALITY: 3, AMBIENCE: 3 },
    { comment: 'Cold food', issue: 'Waiting Time' },
  )
}

beforeEach(async () => {
  const db = await freshDb()
  const outlet = await outletId(db)
  await seedActivity(db, outlet)
  ctx = { db, outlet }
})

describe('v_feedback_daily', () => {
  it('rolls up a day into counts and an average', async () => {
    const day = await one<{
      feedback_count: number
      avg_score: string
      positive_count: number
      neutral_count: number
      negative_count: number
      follow_up_count: number
      comment_count: number
      identified_guest_count: number
    }>(ctx.db, `select * from v_feedback_daily where local_date = '2026-08-23'`)

    expect(day.feedback_count).toBe(3)
    expect(day.negative_count).toBe(2)
    expect(day.neutral_count).toBe(1)
    expect(day.positive_count).toBe(0)
    expect(day.follow_up_count).toBe(1)
    expect(day.comment_count).toBe(2)
    expect(day.identified_guest_count).toBe(1)

    await ctx.db.close()
  })

  it('keeps days separate', async () => {
    const days = await rows<{ local_date: string; feedback_count: number }>(
      ctx.db,
      `select local_date, feedback_count from v_feedback_daily order by local_date`,
    )
    expect(days.map((d) => d.feedback_count)).toEqual([2, 3])
    await ctx.db.close()
  })
})

describe('v_category_daily', () => {
  it('separates a collapsing category from a healthy one', async () => {
    const service = await one<{ avg_rating: string; negative_count: number }>(
      ctx.db,
      `select v.avg_rating, v.negative_count
       from v_category_daily v join categories c using (category_id)
       where c.name = 'SERVICE' and v.local_date = '2026-08-23'`,
    )
    const food = await one<{ avg_rating: string; negative_count: number }>(
      ctx.db,
      `select v.avg_rating, v.negative_count
       from v_category_daily v join categories c using (category_id)
       where c.name = 'FOOD' and v.local_date = '2026-08-23'`,
    )

    // Service: 1, 3, 2 -> 2.00 with two negatives. Food: 5, 3, 2 -> 3.33.
    expect(Number(service.avg_rating)).toBeCloseTo(2, 2)
    expect(service.negative_count).toBe(2)
    expect(Number(food.avg_rating)).toBeCloseTo(3.33, 2)

    await ctx.db.close()
  })
})

describe('v_issue_daily and v_theme_daily', () => {
  it('counts issue mentions per day', async () => {
    const issue = await one<{ mention_count: number }>(
      ctx.db,
      `select v.mention_count from v_issue_daily v join issues i using (issue_id)
       where i.name = 'Waiting Time' and v.local_date = '2026-08-23'`,
    )
    expect(issue.mention_count).toBe(2)
    await ctx.db.close()
  })

  it('sums theme mentions, not just matching feedbacks', async () => {
    const feedbackId = await one<{ feedback_id: string }>(
      ctx.db,
      `select feedback_id from feedback where comment = 'Cold food'`,
    )
    const theme = await one<{ theme_id: string }>(
      ctx.db,
      `select theme_id from themes where name = 'Cold Food' and kind = 'negative'`,
    )
    await ctx.db.query(
      `insert into feedback_themes (feedback_id, theme_id, mentions) values ($1, $2, 3)`,
      [feedbackId.feedback_id, theme.theme_id],
    )

    const row = await one<{ feedback_count: number; mention_count: number }>(
      ctx.db,
      `select feedback_count, mention_count from v_theme_daily where theme_id = $1`,
      [theme.theme_id],
    )
    expect(row.feedback_count).toBe(1)
    expect(Number(row.mention_count)).toBe(3)
    await ctx.db.close()
  })
})

describe('v_follow_up_facts', () => {
  it('leaves resolution_hours null while a follow-up is open', async () => {
    const open = await one<{ status: string; resolution_hours: string | null }>(
      ctx.db,
      `select status, resolution_hours from v_follow_up_facts`,
    )
    expect(open.status).toBe('OPEN')
    expect(open.resolution_hours).toBeNull()
    await ctx.db.close()
  })

  it('measures hours once resolved', async () => {
    await ctx.db.query(
      `update follow_ups
       set status = 'RESOLVED',
           created_at = now() - interval '5 hours',
           resolved_at = now()`,
    )
    const resolved = await one<{ resolution_hours: string }>(
      ctx.db,
      `select resolution_hours from v_follow_up_facts`,
    )
    expect(Number(resolved.resolution_hours)).toBeCloseTo(5, 1)
    await ctx.db.close()
  })
})

describe('v_guest_summary', () => {
  it('classifies repeat, negative and high-engagement guests', async () => {
    const guest = await one<{
      total_feedbacks: number
      is_repeat: boolean
      is_negative: boolean
      is_high_engagement: boolean
      has_phone: boolean
      has_open_follow_up: boolean
    }>(ctx.db, `select * from v_guest_summary`)

    expect(guest.total_feedbacks).toBe(2)
    expect(guest.is_repeat).toBe(true)
    expect(guest.has_phone).toBe(true)
    expect(guest.is_high_engagement).toBe(false)
    expect(guest.has_open_follow_up).toBe(true)
    await ctx.db.close()
  })
})

describe('views respect RLS — security_invoker, not definer', () => {
  it('hides another outlet’s rows from an admin of this one', async () => {
    await asServiceRole(ctx.db)

    const other = await one<{ outlet_id: string }>(
      ctx.db,
      `insert into outlets (name, code) values ('Second Café', 'SEC') returning outlet_id`,
    )
    await ctx.db.query(
      `insert into feedback (outlet_id, local_date, overall_score, sentiment)
       values ($1, '2026-08-23', 5.00, 'positive')`,
      [other.outlet_id],
    )

    const auth = await one<{ id: string }>(
      ctx.db,
      `insert into auth.users (email) values ('owner@aic.test') returning id`,
    )
    await ctx.db.query(
      `insert into app_users (user_id, outlet_id, name, email, role)
       values ($1, $2, 'Owner', 'owner@aic.test', 'OWNER')`,
      [auth.id, ctx.outlet],
    )

    await asUser(ctx.db, auth.id)

    const visible = await rows<{ outlet_id: string }>(
      ctx.db,
      `select distinct outlet_id from v_feedback_daily`,
    )
    expect(visible.map((r) => r.outlet_id)).toEqual([ctx.outlet])

    await ctx.db.close()
  })

  it('gives anon nothing', async () => {
    const { asAnon, isDenied } = await import('./harness')
    await asAnon(ctx.db)
    expect(await isDenied(ctx.db.query(`select * from v_feedback_daily`))).toBe(true)
    expect(await isDenied(ctx.db.query(`select * from v_guest_summary`))).toBe(true)
    await ctx.db.close()
  })
})
