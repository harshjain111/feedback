import { describe, expect, it } from 'vitest'
import { freshDb, one, rows, type Db } from './harness'

const M = '0001_core_schema.sql'

async function seedOutlet(db: Db): Promise<string> {
  const row = await one<{ outlet_id: string }>(
    db,
    `insert into outlets (name, code, city) values ('All India Café', 'AIC', 'Mumbai')
     returning outlet_id`,
  )
  return row.outlet_id
}

async function seedCategory(db: Db, outlet: string, name = 'FOOD'): Promise<string> {
  const row = await one<{ category_id: string }>(
    db,
    `insert into categories (outlet_id, name, question, icon, display_order)
     values ($1, $2, 'How did your food make you feel?', 'utensils', 1)
     returning category_id`,
    [outlet, name],
  )
  return row.category_id
}

describe('0001 — migration applies', () => {
  it('creates every table in CLAUDE.md §7', async () => {
    const db = await freshDb(M)
    const found = await rows<{ table_name: string }>(
      db,
      `select table_name from information_schema.tables
       where table_schema = 'public' order by table_name`,
    )
    const names = found.map((r) => r.table_name)

    for (const expected of [
      'alerts',
      'app_config',
      'app_users',
      'audit_log',
      'categories',
      'code_counters',
      'feedback',
      'feedback_issues',
      'feedback_ratings',
      'feedback_themes',
      'follow_up_notes',
      'follow_ups',
      'guests',
      'issues',
      'kiosks',
      'outlets',
      'rating_scale',
      'theme_keywords',
      'themes',
    ]) {
      expect(names, `missing table ${expected}`).toContain(expected)
    }
    await db.close()
  })

  it('puts outlet_id on every table that §7 requires it on', async () => {
    const db = await freshDb(M)
    for (const table of [
      'rating_scale',
      'themes',
      'app_config',
      'follow_ups',
      'audit_log',
      'categories',
      'issues',
      'guests',
      'feedback',
      'alerts',
      'app_users',
      'kiosks',
    ]) {
      const cols = await rows<{ column_name: string }>(
        db,
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = $1 and column_name = 'outlet_id'`,
        [table],
      )
      expect(cols.length, `${table} has no outlet_id`).toBe(1)
    }
    await db.close()
  })
})

describe('0001 — code generators', () => {
  it('numbers guests AIC-000001 upwards', async () => {
    const db = await freshDb(M)
    const outlet = await seedOutlet(db)

    const codes: string[] = []
    for (let i = 0; i < 3; i++) {
      const row = await one<{ guest_code: string }>(
        db,
        `insert into guests (outlet_id, phone) values ($1, $2) returning guest_code`,
        [outlet, `98765432${10 + i}`],
      )
      codes.push(row.guest_code)
    }

    expect(codes).toEqual(['AIC-000001', 'AIC-000002', 'AIC-000003'])
    await db.close()
  })

  it('numbers feedback AIC-YYYYMMDD-00001 and resets the counter each Kolkata day', async () => {
    const db = await freshDb(M)
    const outlet = await seedOutlet(db)

    const day1a = await one<{ feedback_code: string }>(
      db,
      `insert into feedback (outlet_id, submitted_at) values ($1, '2026-08-23T10:00:00+05:30')
       returning feedback_code`,
      [outlet],
    )
    const day1b = await one<{ feedback_code: string }>(
      db,
      `insert into feedback (outlet_id, submitted_at) values ($1, '2026-08-23T19:00:00+05:30')
       returning feedback_code`,
      [outlet],
    )
    const day2 = await one<{ feedback_code: string }>(
      db,
      `insert into feedback (outlet_id, submitted_at) values ($1, '2026-08-24T10:00:00+05:30')
       returning feedback_code`,
      [outlet],
    )

    expect(day1a.feedback_code).toBe('AIC-20260823-00001')
    expect(day1b.feedback_code).toBe('AIC-20260823-00002')
    expect(day2.feedback_code).toBe('AIC-20260824-00001')
    await db.close()
  })

  it('derives the Kolkata date from the instant, not the server timezone', async () => {
    const db = await freshDb(M)
    const outlet = await seedOutlet(db)

    // 22:00 UTC on the 23rd is 03:30 on the 24th in Kolkata.
    const row = await one<{ feedback_code: string; local_date: string; hour_bucket: string }>(
      db,
      `insert into feedback (outlet_id, submitted_at) values ($1, '2026-08-23T22:00:00Z')
       returning feedback_code, local_date, hour_bucket`,
      [outlet],
    )

    expect(row.feedback_code).toBe('AIC-20260824-00001')
    expect(String(row.local_date)).toContain('Aug 24 2026')
    // 03:30 IST falls outside service hours.
    expect(row.hour_bucket).toBe('other')
    await db.close()
  })
})

describe('0001 — idempotency', () => {
  it('rejects a second insert with the same submission_id', async () => {
    const db = await freshDb(M)
    const outlet = await seedOutlet(db)
    const submission = '11111111-1111-4111-8111-111111111111'

    await db.query(`insert into feedback (outlet_id, submission_id) values ($1, $2)`, [
      outlet,
      submission,
    ])

    await expect(
      db.query(`insert into feedback (outlet_id, submission_id) values ($1, $2)`, [
        outlet,
        submission,
      ]),
    ).rejects.toThrow(/feedback_outlet_submission_key|duplicate key/i)

    await db.close()
  })

  it('defaults submission_id so no row is ever without one', async () => {
    const db = await freshDb(M)
    const outlet = await seedOutlet(db)
    const row = await one<{ submission_id: string }>(
      db,
      `insert into feedback (outlet_id) values ($1) returning submission_id`,
      [outlet],
    )
    expect(row.submission_id).toMatch(/^[0-9a-f-]{36}$/)
    await db.close()
  })
})

describe('0001 — guest aggregate trigger', () => {
  it('maintains totals, average and first/last dates without app code', async () => {
    const db = await freshDb(M)
    const outlet = await seedOutlet(db)
    await seedCategory(db, outlet)

    const guest = await one<{ guest_id: string }>(
      db,
      `insert into guests (outlet_id, name, phone) values ($1, 'Asha', '9876543210')
       returning guest_id`,
      [outlet],
    )

    await db.query(
      `insert into feedback (outlet_id, guest_id, submitted_at, overall_score)
       values ($1, $2, '2026-08-01T13:00:00+05:30', 3.00)`,
      [outlet, guest.guest_id],
    )
    await db.query(
      `insert into feedback (outlet_id, guest_id, submitted_at, overall_score)
       values ($1, $2, '2026-08-10T13:00:00+05:30', 4.50)`,
      [outlet, guest.guest_id],
    )

    const after = await one<{
      total_feedbacks: number
      average_rating: string
      first_feedback_date: string
      last_feedback_date: string
    }>(db, `select * from guests where guest_id = $1`, [guest.guest_id])

    expect(after.total_feedbacks).toBe(2)
    expect(Number(after.average_rating)).toBeCloseTo(3.75, 2)
    expect(String(after.first_feedback_date)).toContain('Aug 01 2026')
    expect(String(after.last_feedback_date)).toContain('Aug 10 2026')

    await db.close()
  })

  it('recomputes when an anonymous feedback is later attached to a guest', async () => {
    const db = await freshDb(M)
    const outlet = await seedOutlet(db)
    const guest = await one<{ guest_id: string }>(
      db,
      `insert into guests (outlet_id, phone) values ($1, '9000000000') returning guest_id`,
      [outlet],
    )
    const fb = await one<{ feedback_id: string }>(
      db,
      `insert into feedback (outlet_id, overall_score) values ($1, 5.00) returning feedback_id`,
      [outlet],
    )

    await db.query(`update feedback set guest_id = $1 where feedback_id = $2`, [
      guest.guest_id,
      fb.feedback_id,
    ])

    const after = await one<{ total_feedbacks: number }>(
      db,
      `select total_feedbacks from guests where guest_id = $1`,
      [guest.guest_id],
    )
    expect(after.total_feedbacks).toBe(1)
    await db.close()
  })
})

describe('0001 — status has one owner', () => {
  it('mirrors follow_ups.status onto feedback.status', async () => {
    const db = await freshDb(M)
    const outlet = await seedOutlet(db)
    const fb = await one<{ feedback_id: string; status: string }>(
      db,
      `insert into feedback (outlet_id, follow_up_requested) values ($1, true)
       returning feedback_id, status`,
      [outlet],
    )
    expect(fb.status).toBe('NEW')

    await db.query(`insert into follow_ups (outlet_id, feedback_id) values ($1, $2)`, [
      outlet,
      fb.feedback_id,
    ])
    let now = await one<{ status: string }>(
      db,
      `select status from feedback where feedback_id = $1`,
      [fb.feedback_id],
    )
    expect(now.status).toBe('OPEN')

    await db.query(`update follow_ups set status = 'RESOLVED' where feedback_id = $1`, [
      fb.feedback_id,
    ])
    now = await one<{ status: string }>(db, `select status from feedback where feedback_id = $1`, [
      fb.feedback_id,
    ])
    expect(now.status).toBe('RESOLVED')

    await db.close()
  })

  it('rejects a direct write to feedback.status', async () => {
    const db = await freshDb(M)
    const outlet = await seedOutlet(db)
    const fb = await one<{ feedback_id: string }>(
      db,
      `insert into feedback (outlet_id) values ($1) returning feedback_id`,
      [outlet],
    )

    await expect(
      db.query(`update feedback set status = 'CLOSED' where feedback_id = $1`, [fb.feedback_id]),
    ).rejects.toThrow(/denormalised mirror/i)

    await db.close()
  })

  it('allows one follow-up per feedback and no more', async () => {
    const db = await freshDb(M)
    const outlet = await seedOutlet(db)
    const fb = await one<{ feedback_id: string }>(
      db,
      `insert into feedback (outlet_id) values ($1) returning feedback_id`,
      [outlet],
    )
    await db.query(`insert into follow_ups (outlet_id, feedback_id) values ($1, $2)`, [
      outlet,
      fb.feedback_id,
    ])
    await expect(
      db.query(`insert into follow_ups (outlet_id, feedback_id) values ($1, $2)`, [
        outlet,
        fb.feedback_id,
      ]),
    ).rejects.toThrow(/duplicate key|follow_ups_feedback_id_key/i)
    await db.close()
  })
})

describe('0001 — alert dedupe', () => {
  it('permits one open alert per dedupe_key and a new one after acknowledgement', async () => {
    const db = await freshDb(M)
    const outlet = await seedOutlet(db)
    const key = 'LOW_RATING_CLUSTER:service:2026-08-23T19'

    await db.query(
      `insert into alerts (outlet_id, type, dedupe_key, title)
       values ($1, 'LOW_RATING_CLUSTER', $2, '3 low ratings on Service')`,
      [outlet, key],
    )

    await expect(
      db.query(
        `insert into alerts (outlet_id, type, dedupe_key, title)
         values ($1, 'LOW_RATING_CLUSTER', $2, 'duplicate')`,
        [outlet, key],
      ),
    ).rejects.toThrow(/alerts_outlet_dedupe_open_key|duplicate key/i)

    await db.query(`update alerts set acknowledged_at = now() where dedupe_key = $1`, [key])

    // Same condition may fire again once the first one is acknowledged.
    await db.query(
      `insert into alerts (outlet_id, type, dedupe_key, title)
       values ($1, 'LOW_RATING_CLUSTER', $2, 'fired again')`,
      [outlet, key],
    )

    const all = await rows<{ count: string }>(
      db,
      `select count(*)::text as count from alerts where dedupe_key = $1`,
      [key],
    )
    expect(Number(all[0]?.count)).toBe(2)
    await db.close()
  })
})

describe('0001 — constraints', () => {
  it('rejects a rating outside 1..5', async () => {
    const db = await freshDb(M)
    const outlet = await seedOutlet(db)
    const category = await seedCategory(db, outlet)
    const fb = await one<{ feedback_id: string }>(
      db,
      `insert into feedback (outlet_id) values ($1) returning feedback_id`,
      [outlet],
    )
    await expect(
      db.query(
        `insert into feedback_ratings (feedback_id, category_id, rating) values ($1, $2, 6)`,
        [fb.feedback_id, category],
      ),
    ).rejects.toThrow(/check constraint/i)
    await db.close()
  })

  it('rejects a malformed colour on the rating scale', async () => {
    const db = await freshDb(M)
    const outlet = await seedOutlet(db)
    await expect(
      db.query(
        `insert into rating_scale (outlet_id, value, face_key, label, colour)
         values ($1, 1, 'angry', 'Very Poor', 'red')`,
        [outlet],
      ),
    ).rejects.toThrow(/check constraint/i)
    await db.close()
  })

  it('keeps phone unique per outlet but allows many anonymous guests', async () => {
    const db = await freshDb(M)
    const outlet = await seedOutlet(db)
    await db.query(`insert into guests (outlet_id, phone) values ($1, '9876543210')`, [outlet])
    await expect(
      db.query(`insert into guests (outlet_id, phone) values ($1, '9876543210')`, [outlet]),
    ).rejects.toThrow(/duplicate key/i)

    await db.query(`insert into guests (outlet_id) values ($1)`, [outlet])
    await db.query(`insert into guests (outlet_id) values ($1)`, [outlet])
    const count = await one<{ count: string }>(
      db,
      `select count(*)::text as count from guests where phone is null`,
    )
    expect(Number(count.count)).toBe(2)
    await db.close()
  })
})
