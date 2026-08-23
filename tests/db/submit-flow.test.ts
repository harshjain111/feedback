/**
 * The submit sequence of POST /api/feedback, replayed against the real schema.
 *
 * The route talks to Supabase over HTTP, which there is no project for yet, so
 * this exercises the same ordered set of statements directly: guest resolution,
 * the feedback row, ratings, chips, themes, the follow-up, and everything the
 * triggers are supposed to do in response. If the route and the schema ever
 * disagree, this is where it shows up.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { freshDb, one, outletId, rows, type Db } from './harness'

type Ctx = { db: Db; outlet: string }
let ctx: Ctx

beforeEach(async () => {
  const db = await freshDb()
  ctx = { db, outlet: await outletId(db) }
})

async function categoryIds(db: Db): Promise<string[]> {
  const found = await rows<{ category_id: string }>(
    db,
    `select category_id from categories order by display_order`,
  )
  return found.map((r) => r.category_id)
}

/** The route's insert sequence, in the route's order. */
async function submit(
  db: Db,
  outlet: string,
  options: {
    submissionId: string
    ratings: number[]
    phone?: string
    name?: string
    comment?: string | null
    followUp?: boolean
    issueNames?: string[]
  },
): Promise<{ feedbackId: string; feedbackCode: string; guestId: string | null }> {
  const categories = await categoryIds(db)

  let guestId: string | null = null
  if (options.phone) {
    const existing = await rows<{ guest_id: string }>(
      db,
      `select guest_id from guests where outlet_id = $1 and phone = $2`,
      [outlet, options.phone],
    )
    if (existing[0]) {
      guestId = existing[0].guest_id
      if (options.name) {
        await db.query(`update guests set name = $2 where guest_id = $1`, [guestId, options.name])
      }
    } else {
      const created = await one<{ guest_id: string }>(
        db,
        `insert into guests (outlet_id, phone, name) values ($1, $2, $3) returning guest_id`,
        [outlet, options.phone, options.name ?? null],
      )
      guestId = created.guest_id
    }
  }

  const score = options.ratings.reduce((a, b) => a + b, 0) / options.ratings.length
  const sentiment = options.ratings.some((r) => r <= 2)
    ? 'negative'
    : score >= 4
      ? 'positive'
      : 'neutral'

  const feedback = await one<{ feedback_id: string; feedback_code: string }>(
    db,
    `insert into feedback
       (outlet_id, guest_id, submission_id, overall_score, sentiment, comment, follow_up_requested)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning feedback_id, feedback_code`,
    [
      outlet,
      guestId,
      options.submissionId,
      Math.round(score * 100) / 100,
      sentiment,
      options.comment ?? null,
      options.followUp ?? false,
    ],
  )

  for (const [index, rating] of options.ratings.entries()) {
    await db.query(
      `insert into feedback_ratings (feedback_id, category_id, rating) values ($1, $2, $3)`,
      [feedback.feedback_id, categories[index], rating],
    )
  }

  for (const name of options.issueNames ?? []) {
    const issue = await one<{ issue_id: string }>(
      db,
      `select issue_id from issues where outlet_id = $1 and name = $2 and kind = 'negative'`,
      [outlet, name],
    )
    await db.query(`insert into feedback_issues (feedback_id, issue_id) values ($1, $2)`, [
      feedback.feedback_id,
      issue.issue_id,
    ])
  }

  if (options.followUp) {
    await db.query(
      `insert into follow_ups (outlet_id, feedback_id, guest_id, status)
       values ($1, $2, $3, 'OPEN')`,
      [outlet, feedback.feedback_id, guestId],
    )
  }

  return {
    feedbackId: feedback.feedback_id,
    feedbackCode: feedback.feedback_code,
    guestId,
  }
}

describe('submit — anonymous journey', () => {
  it('records a feedback with no guest and still counts it', async () => {
    const result = await submit(ctx.db, ctx.outlet, {
      submissionId: '11111111-1111-4111-8111-111111111111',
      ratings: [5, 5, 4, 5],
    })

    expect(result.guestId).toBeNull()
    expect(result.feedbackCode).toMatch(/^AIC-\d{8}-\d{5}$/)

    const row = await one<{
      guest_id: string | null
      overall_score: string
      sentiment: string
      status: string
      local_date: string
      hour_bucket: string
    }>(ctx.db, `select * from feedback where feedback_id = $1`, [result.feedbackId])

    expect(row.guest_id).toBeNull()
    expect(Number(row.overall_score)).toBeCloseTo(4.75, 2)
    expect(row.sentiment).toBe('positive')
    expect(row.status).toBe('NEW')
    expect(row.local_date).toBeTruthy()
    expect(row.hour_bucket).toBeTruthy()

    await ctx.db.close()
  })
})

describe('submit — phone is the guest key (§7)', () => {
  it('creates a guest on a new number and attaches to it on the next visit', async () => {
    const first = await submit(ctx.db, ctx.outlet, {
      submissionId: '22222222-2222-4222-8222-222222222222',
      ratings: [4, 4, 4, 4],
      phone: '9876543210',
      name: 'Asha',
    })

    const second = await submit(ctx.db, ctx.outlet, {
      submissionId: '33333333-3333-4333-8333-333333333333',
      ratings: [5, 5, 5, 5],
      phone: '9876543210',
    })

    expect(second.guestId).toBe(first.guestId)

    const guests = await rows<{ guest_code: string }>(ctx.db, `select guest_code from guests`)
    expect(guests.length).toBe(1)
    expect(guests[0]?.guest_code).toBe('AIC-000001')

    // Aggregates come from the trigger, never from app code.
    const guest = await one<{ total_feedbacks: number; average_rating: string; name: string }>(
      ctx.db,
      `select total_feedbacks, average_rating, name from guests where guest_id = $1`,
      [first.guestId],
    )
    expect(guest.total_feedbacks).toBe(2)
    expect(Number(guest.average_rating)).toBeCloseTo(4.5, 2)
    expect(guest.name).toBe('Asha')

    await ctx.db.close()
  })

  it('keeps two different numbers as two different guests', async () => {
    await submit(ctx.db, ctx.outlet, {
      submissionId: '44444444-4444-4444-8444-444444444444',
      ratings: [4, 4, 4, 4],
      phone: '9876543210',
    })
    await submit(ctx.db, ctx.outlet, {
      submissionId: '55555555-5555-4555-8555-555555555555',
      ratings: [4, 4, 4, 4],
      phone: '9000000001',
    })

    const codes = await rows<{ guest_code: string }>(
      ctx.db,
      `select guest_code from guests order by guest_code`,
    )
    expect(codes.map((r) => r.guest_code)).toEqual(['AIC-000001', 'AIC-000002'])
    await ctx.db.close()
  })
})

describe('submit — idempotency', () => {
  it('cannot write the same journey twice', async () => {
    const id = '66666666-6666-4666-8666-666666666666'
    await submit(ctx.db, ctx.outlet, { submissionId: id, ratings: [3, 3, 3, 3] })

    await expect(
      submit(ctx.db, ctx.outlet, { submissionId: id, ratings: [3, 3, 3, 3] }),
    ).rejects.toThrow(/duplicate key|feedback_outlet_submission_key/i)

    const count = await one<{ count: string }>(
      ctx.db,
      `select count(*)::text as count from feedback`,
    )
    expect(Number(count.count)).toBe(1)
    await ctx.db.close()
  })
})

describe('submit — negative journey with a follow-up', () => {
  it('opens a follow-up and lets the trigger mirror the status', async () => {
    const result = await submit(ctx.db, ctx.outlet, {
      submissionId: '77777777-7777-4777-8777-777777777777',
      ratings: [5, 1, 4, 5],
      phone: '9876543210',
      comment: 'Waited 40 minutes and the food was cold.',
      followUp: true,
      issueNames: ['Waiting Time', 'Food'],
    })

    const feedback = await one<{ sentiment: string; status: string; follow_up_requested: boolean }>(
      ctx.db,
      `select sentiment, status, follow_up_requested from feedback where feedback_id = $1`,
      [result.feedbackId],
    )
    // One category at 1 sends the whole journey negative even though the mean
    // is 3.75 (§4).
    expect(feedback.sentiment).toBe('negative')
    expect(feedback.follow_up_requested).toBe(true)
    expect(feedback.status).toBe('OPEN')

    const chips = await rows<{ name: string }>(
      ctx.db,
      `select i.name from feedback_issues fi join issues i using (issue_id)
       where fi.feedback_id = $1 order by i.name`,
      [result.feedbackId],
    )
    expect(chips.map((c) => c.name)).toEqual(['Food', 'Waiting Time'])

    await ctx.db.close()
  })

  it('preserves the comment verbatim (§14.10)', async () => {
    const comment = 'The dosa was cold.\n\nOtherwise a lovely evening.'
    const result = await submit(ctx.db, ctx.outlet, {
      submissionId: '88888888-8888-4888-8888-888888888888',
      ratings: [2, 4, 4, 4],
      comment,
    })

    const stored = await one<{ comment: string }>(
      ctx.db,
      `select comment from feedback where feedback_id = $1`,
      [result.feedbackId],
    )
    expect(stored.comment).toBe(comment)
    await ctx.db.close()
  })
})

describe('submit — theme rows', () => {
  it('indexes a comment against the seeded lexicon without touching it', async () => {
    const comment = 'We had to wait a long time and the bill was wrong.'
    const result = await submit(ctx.db, ctx.outlet, {
      submissionId: '99999999-9999-4999-8999-999999999999',
      ratings: [2, 2, 3, 3],
      comment,
    })

    // What the route does after the insert: match, then write feedback_themes.
    const waiting = await one<{ theme_id: string }>(
      ctx.db,
      `select theme_id from themes where name = 'Waiting' and kind = 'negative'`,
    )
    const billing = await one<{ theme_id: string }>(
      ctx.db,
      `select theme_id from themes where name = 'Billing' and kind = 'negative'`,
    )

    await ctx.db.query(
      `insert into feedback_themes (feedback_id, theme_id, mentions)
       values ($1, $2, 1), ($1, $3, 1)`,
      [result.feedbackId, waiting.theme_id, billing.theme_id],
    )

    const themed = await rows<{ name: string }>(
      ctx.db,
      `select t.name from feedback_themes ft join themes t using (theme_id)
       where ft.feedback_id = $1 order by t.name`,
      [result.feedbackId],
    )
    expect(themed.map((t) => t.name)).toEqual(['Billing', 'Waiting'])

    const stored = await one<{ comment: string }>(
      ctx.db,
      `select comment from feedback where feedback_id = $1`,
      [result.feedbackId],
    )
    expect(stored.comment).toBe(comment)

    await ctx.db.close()
  })
})
