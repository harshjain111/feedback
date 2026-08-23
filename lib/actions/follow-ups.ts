'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { canTransition, type FollowUpStatus } from '@/lib/follow-up-workflow'

/**
 * The follow-up workflow (§28, §30).
 *
 * Every mutation here goes through the RLS-bound client, so a STAFF user acting
 * on someone else's follow-up simply matches no rows — the check is in the
 * database, not in this file. The audit write afterwards uses the service role
 * because nobody, not even OWNER, may insert into audit_log directly (0003).
 *
 * Nothing here ever writes feedback.status. The trigger from 0001 mirrors it,
 * and a guard trigger raises if anything else tries.
 */

type ActionResult = { ok: true } | { ok: false; error: string }

async function audit(
  action: string,
  followUpId: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  await createAdminClient()
    .from('audit_log')
    .insert({
      outlet_id: user.outletId,
      user_id: user.userId,
      action,
      entity: 'follow_ups',
      entity_id: followUpId,
      before: before as never,
      after: after as never,
    })
}

export async function transitionFollowUp(
  followUpId: string,
  next: FollowUpStatus,
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!can(user, 'manage:followups')) return { ok: false, error: 'Not permitted' }

  const client = await createClient()

  const { data: current, error: readError } = await client
    .from('follow_ups')
    .select('follow_up_id, status, feedback_id')
    .eq('follow_up_id', followUpId)
    .maybeSingle()

  if (readError) return { ok: false, error: readError.message }
  // Invisible under RLS reads the same as absent, which is the point.
  if (!current) return { ok: false, error: 'Follow-up not found' }

  if (!canTransition(current.status, next)) {
    return { ok: false, error: `Cannot move from ${current.status} to ${next}` }
  }

  const { error: writeError } = await client
    .from('follow_ups')
    .update({
      status: next,
      // Set once, when it actually resolves; reopening clears it so the
      // resolution-time metric never counts a stale timestamp.
      resolved_at: next === 'RESOLVED' ? new Date().toISOString() : null,
    })
    .eq('follow_up_id', followUpId)

  if (writeError) return { ok: false, error: writeError.message }

  await audit('FOLLOW_UP_TRANSITION', followUpId, { status: current.status }, { status: next })
  revalidatePath(`/admin/feedback/${current.feedback_id}`)
  revalidatePath('/admin/feedback')

  return { ok: true }
}

export async function assignFollowUp(
  followUpId: string,
  assignedTo: string | null,
): Promise<ActionResult> {
  const user = await getCurrentUser()
  // Handing work to someone else is a manager's job, not a staff member's.
  if (!can(user, 'view:guests')) return { ok: false, error: 'Not permitted' }

  const client = await createClient()
  const { data: current } = await client
    .from('follow_ups')
    .select('assigned_to, feedback_id')
    .eq('follow_up_id', followUpId)
    .maybeSingle()

  const { error } = await client
    .from('follow_ups')
    .update({ assigned_to: assignedTo })
    .eq('follow_up_id', followUpId)

  if (error) return { ok: false, error: error.message }

  await audit(
    'FOLLOW_UP_ASSIGN',
    followUpId,
    { assigned_to: current?.assigned_to ?? null },
    { assigned_to: assignedTo },
  )
  if (current?.feedback_id) revalidatePath(`/admin/feedback/${current.feedback_id}`)

  return { ok: true }
}

export async function addFollowUpNote(followUpId: string, body: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!can(user, 'manage:followups')) return { ok: false, error: 'Not permitted' }

  const text = body.trim()
  if (text === '') return { ok: false, error: 'A note needs some text' }

  const client = await createClient()
  const { error } = await client.from('follow_up_notes').insert({
    follow_up_id: followUpId,
    // The RLS policy requires author_id = auth.uid(), so a note can never be
    // filed under someone else's name.
    author_id: user!.userId,
    body: text,
  })

  if (error) return { ok: false, error: error.message }

  const { data: parent } = await client
    .from('follow_ups')
    .select('feedback_id')
    .eq('follow_up_id', followUpId)
    .maybeSingle()

  if (parent?.feedback_id) revalidatePath(`/admin/feedback/${parent.feedback_id}`)
  return { ok: true }
}

export async function setResolution(followUpId: string, resolution: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!can(user, 'manage:followups')) return { ok: false, error: 'Not permitted' }

  const client = await createClient()
  const { data: current } = await client
    .from('follow_ups')
    .select('resolution, feedback_id')
    .eq('follow_up_id', followUpId)
    .maybeSingle()

  const { error } = await client
    .from('follow_ups')
    .update({ resolution: resolution.trim() === '' ? null : resolution.trim() })
    .eq('follow_up_id', followUpId)

  if (error) return { ok: false, error: error.message }

  await audit(
    'FOLLOW_UP_RESOLUTION',
    followUpId,
    { resolution: current?.resolution ?? null },
    { resolution },
  )
  if (current?.feedback_id) revalidatePath(`/admin/feedback/${current.feedback_id}`)

  return { ok: true }
}

/** Reveal a guest's number. Always audit-logged, by the function itself (§11). */
export async function revealGuestPhone(
  guestId: string,
  reason?: string,
): Promise<{ ok: true; phone: string | null } | { ok: false; error: string }> {
  const client = await createClient()
  const { data, error } = await client.rpc('aic_reveal_phone', {
    p_guest: guestId,
    p_reason: reason ?? null,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true, phone: (data as string | null) ?? null }
}
