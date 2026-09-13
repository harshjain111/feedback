-- 0021_visible_phone.sql
--
-- Show the guest's real number on the admin surfaces instead of XXXXXX3210.
--
-- Client decision, 13 Sep 2026: the masking made the feedback list unusable for
-- the thing the list is FOR — ringing back the guest who had a bad visit. Every
-- number had to be revealed one at a time through aic_reveal_phone().
--
-- What this does NOT do is make phone numbers readable by everyone. §8 says
-- STAFF get "no guest phone numbers", and that is a security boundary, not a
-- convenience setting. So guests_visible gains a `phone` column that is the real
-- number for OWNER / ADMIN / MANAGER and NULL for STAFF, who keep seeing only
-- phone_masked. Both columns are returned, so callers choose per surface.
--
-- Consequence worth recording against §11: list reads are no longer audited per
-- number, because a list read is not a per-number action. aic_reveal_phone()
-- stays exactly as it is and remains the audited path — it is still what STAFF
-- must use for a follow-up assigned to them, and it is still where an
-- individual, deliberate unmask is recorded. The audit trail for MANAGER+ is
-- therefore coarser than it was. That is the trade the client asked for.

create or replace view guests_visible
with (security_invoker = false)
as
select
  g.guest_id,
  g.outlet_id,
  g.guest_code,
  g.name,
  aic_mask_phone(g.phone) as phone_masked,
  (g.phone is not null)   as has_phone,
  g.first_feedback_date,
  g.last_feedback_date,
  g.total_feedbacks,
  g.average_rating,
  g.created_at,
  g.updated_at,
  -- New, and last in the list: `create or replace view` may only append.
  case
    when aic_current_role() in ('OWNER', 'ADMIN', 'MANAGER') then g.phone
    else null
  end as phone
from guests g
where g.outlet_id = aic_current_outlet()
  and aic_is_member();

revoke all on guests_visible from anon, public;
grant select on guests_visible to authenticated;

comment on view guests_visible is
  'Guest directory. phone_masked is safe for every role; phone holds the real '
  'number for OWNER/ADMIN/MANAGER and NULL for STAFF (§8). An individual, '
  'audited unmask is still aic_reveal_phone().';
