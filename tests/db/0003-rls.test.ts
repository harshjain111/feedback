/**
 * Executable proof of the CLAUDE.md §8 role matrix.
 *
 * Prompt 04 asks for "a short SQL test script proving each role can and cannot
 * do what the matrix says". This is that script, written as tests so it runs in
 * CI instead of being pasted into a console once and forgotten. Every case is a
 * statement executed as the `authenticated` database role with a real
 * auth.uid(), so the policies — not the UI — decide the outcome.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  asAnon,
  asServiceRole,
  asUser,
  freshDb,
  isDenied,
  one,
  outletId,
  rows,
  type Db,
} from './harness'

type Fixture = {
  db: Db
  outlet: string
  owner: string
  admin: string
  manager: string
  staff: string
  otherStaff: string
  guest: string
  feedback: string
  assignedFollowUp: string
  otherFollowUp: string
}

async function makeUser(db: Db, outlet: string, role: string, email: string): Promise<string> {
  const auth = await one<{ id: string }>(
    db,
    `insert into auth.users (email) values ($1) returning id`,
    [email],
  )
  await db.query(
    `insert into app_users (user_id, outlet_id, name, email, role) values ($1, $2, $3, $4, $5)`,
    [auth.id, outlet, role.toLowerCase(), email, role],
  )
  return auth.id
}

async function fixture(): Promise<Fixture> {
  const db = await freshDb()
  const outlet = await outletId(db)

  const owner = await makeUser(db, outlet, 'OWNER', 'owner@aic.test')
  const admin = await makeUser(db, outlet, 'ADMIN', 'admin@aic.test')
  const manager = await makeUser(db, outlet, 'MANAGER', 'manager@aic.test')
  const staff = await makeUser(db, outlet, 'STAFF', 'staff@aic.test')
  const otherStaff = await makeUser(db, outlet, 'STAFF', 'other@aic.test')

  const guest = await one<{ guest_id: string }>(
    db,
    `insert into guests (outlet_id, name, phone) values ($1, 'Asha', '9876543210')
     returning guest_id`,
    [outlet],
  )

  const feedback = await one<{ feedback_id: string }>(
    db,
    `insert into feedback (outlet_id, guest_id, overall_score, comment, follow_up_requested)
     values ($1, $2, 2.00, 'Waited 40 minutes for the food.', true)
     returning feedback_id`,
    [outlet, guest.guest_id],
  )

  const assigned = await one<{ follow_up_id: string }>(
    db,
    `insert into follow_ups (outlet_id, feedback_id, guest_id, assigned_to)
     values ($1, $2, $3, $4) returning follow_up_id`,
    [outlet, feedback.feedback_id, guest.guest_id, staff],
  )

  const otherFeedback = await one<{ feedback_id: string }>(
    db,
    `insert into feedback (outlet_id, overall_score) values ($1, 1.50) returning feedback_id`,
    [outlet],
  )
  const other = await one<{ follow_up_id: string }>(
    db,
    `insert into follow_ups (outlet_id, feedback_id, assigned_to)
     values ($1, $2, $3) returning follow_up_id`,
    [outlet, otherFeedback.feedback_id, otherStaff],
  )

  return {
    db,
    outlet,
    owner,
    admin,
    manager,
    staff,
    otherStaff,
    guest: guest.guest_id,
    feedback: feedback.feedback_id,
    assignedFollowUp: assigned.follow_up_id,
    otherFollowUp: other.follow_up_id,
  }
}

let f: Fixture

beforeEach(async () => {
  f = await fixture()
})

describe('anon — the kiosk visitor sees nothing', () => {
  it('reads zero rows from feedback, guests, app_users and audit_log', async () => {
    await asAnon(f.db)
    for (const table of ['feedback', 'guests', 'app_users', 'audit_log']) {
      const denied = await isDenied(f.db.query(`select * from ${table}`))
      expect(denied, `anon could query ${table}`).toBe(true)
    }
    await f.db.close()
  })

  it('cannot read config or reference tables either (§7: "no anon read. Ever.")', async () => {
    await asAnon(f.db)
    for (const table of ['app_config', 'categories', 'rating_scale', 'issues']) {
      const denied = await isDenied(f.db.query(`select * from ${table}`))
      expect(denied, `anon could query ${table}`).toBe(true)
    }
    await f.db.close()
  })

  it('cannot insert feedback directly — the kiosk must go through the API', async () => {
    await asAnon(f.db)
    const denied = await isDenied(
      f.db.query(`insert into feedback (outlet_id) values ($1)`, [f.outlet]),
    )
    expect(denied).toBe(true)
    await f.db.close()
  })

  it('cannot reach the masked guest view', async () => {
    await asAnon(f.db)
    expect(await isDenied(f.db.query(`select * from guests_visible`))).toBe(true)
    await f.db.close()
  })
})

describe('STAFF — follow-ups assigned to them, and nothing else', () => {
  it('reads the feedback list', async () => {
    await asUser(f.db, f.staff)
    const list = await rows(f.db, `select feedback_id from feedback`)
    expect(list.length).toBe(2)
    await f.db.close()
  })

  it('sees only its own follow-up', async () => {
    await asUser(f.db, f.staff)
    const visible = await rows<{ follow_up_id: string }>(
      f.db,
      `select follow_up_id from follow_ups`,
    )
    expect(visible.map((r) => r.follow_up_id)).toEqual([f.assignedFollowUp])
    await f.db.close()
  })

  it('cannot update someone else’s follow-up', async () => {
    await asUser(f.db, f.staff)
    const result = await f.db.query(
      `update follow_ups set status = 'CONTACTED' where follow_up_id = $1`,
      [f.otherFollowUp],
    )
    // RLS makes the row invisible, so the UPDATE matches nothing.
    expect(result.affectedRows ?? 0).toBe(0)
    await f.db.close()
  })

  it('CANNOT read guest phone numbers — not from the table, not from the view', async () => {
    await asUser(f.db, f.staff)

    const fromTable = await rows(f.db, `select phone from guests`)
    expect(fromTable, 'STAFF must not see any guests row').toEqual([])

    const fromView = await rows<{ name: string; phone_masked: string }>(
      f.db,
      `select name, phone_masked from guests_visible`,
    )
    expect(fromView.length).toBe(1)
    expect(fromView[0]?.name).toBe('Asha')
    expect(fromView[0]?.phone_masked).toBe('XXXXXX3210')

    await f.db.close()
  })

  it('may reveal a number only for a guest on its own assigned follow-up', async () => {
    await asUser(f.db, f.staff)
    const revealed = await one<{ aic_reveal_phone: string }>(
      f.db,
      `select aic_reveal_phone($1) as aic_reveal_phone`,
      [f.guest],
    )
    expect(revealed.aic_reveal_phone).toBe('9876543210')

    await asUser(f.db, f.otherStaff)
    expect(await isDenied(f.db.query(`select aic_reveal_phone($1)`, [f.guest]))).toBe(true)

    await f.db.close()
  })

  it('cannot touch the CMS, users or the audit log', async () => {
    await asUser(f.db, f.staff)

    // A policy-blocked UPDATE is not an error: the rows are simply invisible,
    // so it matches nothing. Asserting on affectedRows is the real check.
    const cfg = await f.db.query(
      `update app_config set value = to_jsonb('hacked'::text) where key = 'rate.h1'`,
    )
    expect(cfg.affectedRows ?? 0).toBe(0)

    const untouched = await one<{ value: string }>(
      f.db,
      `select value #>> '{}' as value from app_config where key = 'rate.h1'`,
    )
    expect(untouched.value).toBe('HOW DID WE DO?')

    expect(await rows(f.db, `select * from audit_log`)).toEqual([])
    expect(await rows(f.db, `select * from alerts`)).toEqual([])

    await f.db.close()
  })
})

describe('MANAGER — operations, no CMS, no users', () => {
  it('reads guests including the masked number', async () => {
    await asUser(f.db, f.manager)
    const guests = await rows<{ phone: string }>(f.db, `select phone from guests`)
    expect(guests.length).toBe(1)

    const view = await rows<{ phone_masked: string }>(
      f.db,
      `select phone_masked from guests_visible`,
    )
    expect(view[0]?.phone_masked).toBe('XXXXXX3210')
    await f.db.close()
  })

  it('sees every follow-up in the outlet', async () => {
    await asUser(f.db, f.manager)
    const all = await rows(f.db, `select follow_up_id from follow_ups`)
    expect(all.length).toBe(2)
    await f.db.close()
  })

  it('CANNOT edit the CMS', async () => {
    await asUser(f.db, f.manager)
    const result = await f.db.query(
      `update app_config set value = to_jsonb('CHANGED'::text) where key = 'welcome.h1'`,
    )
    expect(result.affectedRows ?? 0).toBe(0)

    const still = await one<{ value: string }>(
      f.db,
      `select value #>> '{}' as value from app_config where key = 'welcome.h1'`,
    )
    expect(still.value).toBe('YOUR EXPERIENCE MATTERS.')
    await f.db.close()
  })

  it('CANNOT create or change users', async () => {
    await asUser(f.db, f.manager)
    const denied = await isDenied(
      f.db.query(
        `insert into app_users (user_id, outlet_id, name, email, role)
         values (gen_random_uuid(), $1, 'Sneaky', 'sneaky@aic.test', 'OWNER')`,
        [f.outlet],
      ),
    )
    expect(denied).toBe(true)

    const promote = await f.db.query(`update app_users set role = 'OWNER' where user_id = $1`, [
      f.manager,
    ])
    expect(promote.affectedRows ?? 0).toBe(0)
    await f.db.close()
  })

  it('CANNOT read the audit log', async () => {
    await asUser(f.db, f.manager)
    expect(await rows(f.db, `select * from audit_log`)).toEqual([])
    await f.db.close()
  })
})

describe('ADMIN and OWNER', () => {
  it('ADMIN edits the CMS and the change sticks', async () => {
    await asUser(f.db, f.admin)
    const result = await f.db.query(
      `update app_config set value = to_jsonb('NEW HEADLINE'::text) where key = 'welcome.h1'`,
    )
    expect(result.affectedRows).toBe(1)
    await f.db.close()
  })

  it('ADMIN cannot delete a user; OWNER can (§8)', async () => {
    await asUser(f.db, f.admin)
    const adminAttempt = await f.db.query(`delete from app_users where user_id = $1`, [
      f.otherStaff,
    ])
    expect(adminAttempt.affectedRows ?? 0).toBe(0)

    await asUser(f.db, f.owner)
    const ownerAttempt = await f.db.query(`delete from app_users where user_id = $1`, [
      f.otherStaff,
    ])
    expect(ownerAttempt.affectedRows).toBe(1)
    await f.db.close()
  })

  it('OWNER reads the audit log, and a phone reveal is recorded in it', async () => {
    await asUser(f.db, f.manager)
    await f.db.query(`select aic_reveal_phone($1, 'calling about a complaint')`, [f.guest])

    await asUser(f.db, f.owner)
    const entries = await rows<{ action: string; entity: string }>(
      f.db,
      `select action, entity from audit_log`,
    )
    expect(entries).toEqual([{ action: 'PHONE_REVEAL', entity: 'guests' }])
    await f.db.close()
  })

  it('nobody, not even OWNER, can write the audit log by hand', async () => {
    await asUser(f.db, f.owner)
    const denied = await isDenied(
      f.db.query(
        `insert into audit_log (outlet_id, action, entity) values ($1, 'FAKE', 'guests')`,
        [f.outlet],
      ),
    )
    expect(denied).toBe(true)
    await f.db.close()
  })
})

describe('outlet scoping', () => {
  it('hides another outlet’s data entirely', async () => {
    await asServiceRole(f.db)
    const other = await one<{ outlet_id: string }>(
      f.db,
      `insert into outlets (name, code) values ('Другое', 'XXX') returning outlet_id`,
    )
    await f.db.query(`insert into feedback (outlet_id, overall_score) values ($1, 5.00)`, [
      other.outlet_id,
    ])
    await f.db.query(`insert into guests (outlet_id, phone) values ($1, '9111111111')`, [
      other.outlet_id,
    ])

    await asUser(f.db, f.owner)
    const feedbackRows = await rows<{ outlet_id: string }>(f.db, `select outlet_id from feedback`)
    expect(feedbackRows.every((r) => r.outlet_id === f.outlet)).toBe(true)

    const guestRows = await rows<{ outlet_id: string }>(f.db, `select outlet_id from guests`)
    expect(guestRows.every((r) => r.outlet_id === f.outlet)).toBe(true)

    await f.db.close()
  })
})

describe('nobody writes feedback through the client', () => {
  it('denies insert, update and delete on feedback for every role', async () => {
    for (const user of [f.owner, f.admin, f.manager, f.staff]) {
      await asUser(f.db, user)

      expect(
        await isDenied(f.db.query(`insert into feedback (outlet_id) values ($1)`, [f.outlet])),
        'insert should be denied',
      ).toBe(true)

      expect(
        await isDenied(
          f.db.query(`update feedback set comment = 'edited' where feedback_id = $1`, [f.feedback]),
        ),
        'update should be denied',
      ).toBe(true)

      expect(
        await isDenied(f.db.query(`delete from feedback where feedback_id = $1`, [f.feedback])),
        'delete should be denied',
      ).toBe(true)
    }
    await f.db.close()
  })
})

describe('the memory module cannot reach past its three columns', () => {
  it('lets anon set the photo booleans on a row it knows the submission_id of', async () => {
    const db = await freshDb()
    const outlet = await outletId(db)
    await asServiceRole(db)

    const { submission_id } = await one<{ submission_id: string }>(
      db,
      `insert into feedback (outlet_id, local_date, local_time, day_of_week, hour_bucket,
                             overall_score, sentiment)
       values ($1, '2026-08-24', '19:30', 1, '18-21', 4.50, 'positive')
       returning submission_id`,
      [outlet],
    )

    await asAnon(db)

    // Through the function, which is the ONLY privilege anon has here.
    await db.query(`select aic_record_memory($1, true, null, null)`, [submission_id])
    await db.query(`select aic_record_memory($1, null, true, 2::smallint)`, [submission_id])

    await asServiceRole(db)
    const row = await one<{ memory_offered: boolean; memory_retries: number }>(
      db,
      `select memory_offered, memory_retries from feedback where submission_id = $1`,
      [submission_id],
    )
    expect(row.memory_offered).toBe(true)
    expect(row.memory_retries).toBe(2)

    await db.close()
  })

  it('refuses anon every other column on the same row', async () => {
    // The whole point of the column-level GRANT. A bug in the photo layer must
    // not be able to rewrite a guest's comment or forge a follow-up status, even
    // though it holds a valid submission_id for that row.
    const db = await freshDb()
    const outlet = await outletId(db)
    await asServiceRole(db)

    const { submission_id } = await one<{ submission_id: string }>(
      db,
      `insert into feedback (outlet_id, local_date, local_time, day_of_week, hour_bucket,
                             overall_score, sentiment, comment)
       values ($1, '2026-08-24', '19:30', 1, '18-21', 1.00, 'negative', 'the food was cold')
       returning submission_id`,
      [outlet],
    )

    await asAnon(db)

    for (const column of [
      'comment',
      'overall_score',
      'sentiment',
      'status',
      'outlet_id',
      // The memory columns too: even these are unreachable by direct UPDATE.
      // The function is the only door, so "which columns" is code rather than a
      // privilege that a later migration could widen by accident.
      'memory_printed',
    ]) {
      const denied = await isDenied(
        db.query(`update feedback set ${column} = null where submission_id = $1`, [submission_id]),
      )
      expect(denied, `anon must not be able to write feedback.${column}`).toBe(true)
    }

    await db.close()
  })

  it('does not blank an earlier report when a later one omits it', async () => {
    // The kiosk reports `offered` when the screen appears and `printed` seconds
    // later. Plain assignment would erase the first with the second, and uptake
    // would read as though nobody was ever offered anything.
    const db = await freshDb()
    const outlet = await outletId(db)
    await asServiceRole(db)

    const { submission_id } = await one<{ submission_id: string }>(
      db,
      `insert into feedback (outlet_id, local_date, local_time, day_of_week, hour_bucket,
                             overall_score, sentiment)
       values ($1, '2026-08-24', '19:30', 1, '18-21', 5.00, 'positive')
       returning submission_id`,
      [outlet],
    )

    await asAnon(db)
    await db.query(`select aic_record_memory($1, true, null, null)`, [submission_id])
    await db.query(`select aic_record_memory($1, null, false, 3::smallint)`, [submission_id])

    await asServiceRole(db)
    const row = await one<{ memory_offered: boolean; memory_printed: boolean; memory_retries: number }>(
      db,
      `select memory_offered, memory_printed, memory_retries from feedback where submission_id = $1`,
      [submission_id],
    )
    expect(row.memory_offered).toBe(true)
    expect(row.memory_printed).toBe(false)
    expect(row.memory_retries).toBe(3)

    await db.close()
  })

  it('still refuses anon any read of feedback at all', async () => {
    // What makes submission_id work as a capability: it cannot be enumerated,
    // because anon cannot see the table.
    const db = await freshDb()
    await asAnon(db)
    expect(await isDenied(db.query(`select submission_id from feedback`))).toBe(true)
    await db.close()
  })
})
