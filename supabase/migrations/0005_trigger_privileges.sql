-- =============================================================================
-- 0005_trigger_privileges.sql
--
-- Fixes a bug that only a real, RLS-enforcing database could show.
--
-- Trigger functions run as the INVOKING user unless declared SECURITY DEFINER.
-- Both of our maintenance triggers write to tables the invoker deliberately
-- cannot write to:
--
--   * aic_mirror_follow_up_status() writes feedback.status, and `feedback` has
--     no UPDATE policy for `authenticated` at all — nobody may edit a guest's
--     submission. So when a manager moved a follow-up to CONTACTED, the mirror's
--     UPDATE matched zero rows, silently, and feedback.status stayed OPEN. The
--     feedback list then showed a status that disagreed with the follow-up.
--
--   * aic_feedback_guest_aggregates() writes `guests`, which STAFF cannot see
--     and which nobody may update except MANAGER+.
--
-- An RLS-blocked UPDATE is not an error — it matches no rows and returns
-- quietly — so nothing failed loudly. The PGlite tests missed it because they
-- ran as the table owner, where RLS does not apply.
--
-- Both are system machinery maintaining denormalised columns, so both belong to
-- the definer. `set search_path` is required on any SECURITY DEFINER function:
-- without it a caller could point `public` at their own schema.
-- =============================================================================

create or replace function aic_mirror_follow_up_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_feedback uuid;
  v_status   text;
begin
  if tg_op = 'DELETE' then
    v_feedback := old.feedback_id;
    v_status   := 'NEW';
  else
    v_feedback := new.feedback_id;
    v_status   := new.status;
  end if;

  perform set_config('aic.status_mirror', 'on', true);

  update feedback
  set status = v_status
  where feedback_id = v_feedback
    and status is distinct from v_status;

  perform set_config('aic.status_mirror', 'off', true);

  return null;
end;
$$;

create or replace function aic_recalc_guest_aggregates(p_guest uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_guest is null then
    return;
  end if;

  update guests g
  set total_feedbacks     = coalesce(s.cnt, 0),
      average_rating      = s.avg_score,
      first_feedback_date = s.first_date,
      last_feedback_date  = s.last_date,
      updated_at          = now()
  from (
    select count(*)                     as cnt,
           round(avg(overall_score), 2) as avg_score,
           min(local_date)              as first_date,
           max(local_date)              as last_date
    from feedback
    where guest_id = p_guest
  ) s
  where g.guest_id = p_guest;
end;
$$;

create or replace function aic_feedback_guest_aggregates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform aic_recalc_guest_aggregates(new.guest_id);
  elsif tg_op = 'DELETE' then
    perform aic_recalc_guest_aggregates(old.guest_id);
  else
    perform aic_recalc_guest_aggregates(old.guest_id);
    if new.guest_id is distinct from old.guest_id then
      perform aic_recalc_guest_aggregates(new.guest_id);
    end if;
  end if;

  return null;
end;
$$;

-- Repair any row that drifted while the mirror was silently failing.
do $$
begin
  perform set_config('aic.status_mirror', 'on', true);

  update feedback f
  set status = fu.status
  from follow_ups fu
  where fu.feedback_id = f.feedback_id
    and f.status is distinct from fu.status;

  update feedback f
  set status = 'NEW'
  where not exists (select 1 from follow_ups fu where fu.feedback_id = f.feedback_id)
    and f.status <> 'NEW';

  perform set_config('aic.status_mirror', 'off', true);
end
$$;
