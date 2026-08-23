-- =============================================================================
-- 0003_rls.sql — Row Level Security, CLAUDE.md §7 and §8
--
-- Two facts shape everything below.
--
-- 1. Supabase has ONE database role for every signed-in person: `authenticated`.
--    OWNER/ADMIN/MANAGER/STAFF are rows in app_users, not database roles, so the
--    matrix cannot be expressed with GRANTs alone — it lives in policies that
--    read the caller's app_users row.
--
-- 2. Because of (1), column-level restrictions (STAFF must never see a phone
--    number) cannot be a column GRANT either. Phone access goes through the
--    guests_visible view, which masks at the query layer, and through
--    aic_reveal_phone(), which checks the role and writes an audit_log row.
--    §11: masking is not a UI concern.
--
-- The kiosk is anonymous and gets nothing: it writes through
-- POST /api/feedback with the service role key, server-side only.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Caller identity. SECURITY DEFINER, otherwise reading app_users from inside an
-- app_users policy recurses forever.
-- -----------------------------------------------------------------------------

create or replace function aic_current_outlet()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select outlet_id from app_users where user_id = auth.uid() and active;
$$;

create or replace function aic_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from app_users where user_id = auth.uid() and active;
$$;

create or replace function aic_has_role(variadic p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(aic_current_role() = any(p_roles), false);
$$;

/** True when the caller may manage configuration — the CMS owners (§8). */
create or replace function aic_is_config_owner()
returns boolean
language sql
stable
as $$
  select aic_has_role('OWNER', 'ADMIN');
$$;

/** True for the three roles that see management data (§8: STAFF is excluded). */
create or replace function aic_is_manager_plus()
returns boolean
language sql
stable
as $$
  select aic_has_role('OWNER', 'ADMIN', 'MANAGER');
$$;

/** Any active member of the caller's outlet. */
create or replace function aic_is_member()
returns boolean
language sql
stable
as $$
  select aic_has_role('OWNER', 'ADMIN', 'MANAGER', 'STAFF');
$$;

-- -----------------------------------------------------------------------------
-- Phone masking (§11) — XXXXXX3210
-- -----------------------------------------------------------------------------

create or replace function aic_mask_phone(p_phone text, p_visible int default 4)
returns text
language sql
immutable
as $$
  select case
    when p_phone is null then null
    when length(p_phone) <= p_visible then repeat('X', length(p_phone))
    else repeat('X', length(p_phone) - p_visible) || right(p_phone, p_visible)
  end;
$$;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere. A table without RLS in this list is a bug.
-- -----------------------------------------------------------------------------

alter table outlets          enable row level security;
alter table kiosks           enable row level security;
alter table categories       enable row level security;
alter table issues           enable row level security;
alter table rating_scale     enable row level security;
alter table themes           enable row level security;
alter table theme_keywords   enable row level security;
alter table app_users        enable row level security;
alter table guests           enable row level security;
alter table feedback         enable row level security;
alter table feedback_ratings enable row level security;
alter table feedback_issues  enable row level security;
alter table feedback_themes  enable row level security;
alter table follow_ups       enable row level security;
alter table follow_up_notes  enable row level security;
alter table app_config       enable row level security;
alter table alerts           enable row level security;
alter table audit_log        enable row level security;
alter table code_counters    enable row level security;

-- -----------------------------------------------------------------------------
-- Grants. anon gets nothing at all; the kiosk never reads through it.
-- Every table below still needs a policy — a GRANT alone grants no rows.
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

grant usage on schema public to anon, authenticated;

grant select on
  outlets, kiosks, categories, issues, rating_scale, themes, theme_keywords,
  app_users, guests, feedback, feedback_ratings, feedback_issues, feedback_themes,
  follow_ups, follow_up_notes, app_config, alerts, audit_log
to authenticated;

grant insert, update, delete on
  categories, issues, rating_scale, themes, theme_keywords, app_config, app_users,
  follow_ups, follow_up_notes, alerts, guests, kiosks
to authenticated;

-- code_counters is machinery, not data. Service role only.
revoke all on code_counters from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Outlets and kiosks
-- -----------------------------------------------------------------------------

create policy outlets_select_own on outlets for select to authenticated
  using (outlet_id = aic_current_outlet());

create policy outlets_write_admin on outlets for update to authenticated
  using (outlet_id = aic_current_outlet() and aic_is_config_owner())
  with check (outlet_id = aic_current_outlet());

create policy kiosks_select_member on kiosks for select to authenticated
  using (outlet_id = aic_current_outlet() and aic_is_member());

create policy kiosks_write_admin on kiosks for all to authenticated
  using (outlet_id = aic_current_outlet() and aic_is_config_owner())
  with check (outlet_id = aic_current_outlet() and aic_is_config_owner());

-- -----------------------------------------------------------------------------
-- Reference tables — everyone in the outlet reads, only OWNER/ADMIN write (§8:
-- MANAGER has no CMS).
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['categories', 'issues', 'rating_scale', 'themes', 'app_config']
  loop
    execute format(
      'create policy %1$s_select_member on %1$s for select to authenticated
         using (outlet_id = aic_current_outlet() and aic_is_member())', t);
    execute format(
      'create policy %1$s_write_config_owner on %1$s for all to authenticated
         using (outlet_id = aic_current_outlet() and aic_is_config_owner())
         with check (outlet_id = aic_current_outlet() and aic_is_config_owner())', t);
  end loop;
end
$$;

-- theme_keywords has no outlet_id of its own; it inherits through its theme.
create policy theme_keywords_select_member on theme_keywords for select to authenticated
  using (
    aic_is_member()
    and exists (
      select 1 from themes t
      where t.theme_id = theme_keywords.theme_id and t.outlet_id = aic_current_outlet()
    )
  );

create policy theme_keywords_write_config_owner on theme_keywords for all to authenticated
  using (
    aic_is_config_owner()
    and exists (
      select 1 from themes t
      where t.theme_id = theme_keywords.theme_id and t.outlet_id = aic_current_outlet()
    )
  )
  with check (
    aic_is_config_owner()
    and exists (
      select 1 from themes t
      where t.theme_id = theme_keywords.theme_id and t.outlet_id = aic_current_outlet()
    )
  );

-- -----------------------------------------------------------------------------
-- app_users — everyone sees their colleagues' names (needed to show "assigned
-- to" and note authorship). Only OWNER/ADMIN may change anything; only OWNER
-- may delete, per §8's "ADMIN: everything except user deletion".
-- -----------------------------------------------------------------------------

create policy app_users_select_member on app_users for select to authenticated
  using (outlet_id = aic_current_outlet() and aic_is_member());

create policy app_users_insert_admin on app_users for insert to authenticated
  with check (outlet_id = aic_current_outlet() and aic_is_config_owner());

create policy app_users_update_admin on app_users for update to authenticated
  using (outlet_id = aic_current_outlet() and aic_is_config_owner())
  with check (outlet_id = aic_current_outlet() and aic_is_config_owner());

create policy app_users_delete_owner on app_users for delete to authenticated
  using (outlet_id = aic_current_outlet() and aic_has_role('OWNER'));

-- -----------------------------------------------------------------------------
-- Guests — MANAGER and above only. STAFF reaches guest names through
-- guests_visible (below), never this table, so a phone number cannot leak.
-- -----------------------------------------------------------------------------

create policy guests_select_manager on guests for select to authenticated
  using (outlet_id = aic_current_outlet() and aic_is_manager_plus());

create policy guests_update_manager on guests for update to authenticated
  using (outlet_id = aic_current_outlet() and aic_is_manager_plus())
  with check (outlet_id = aic_current_outlet());

-- -----------------------------------------------------------------------------
-- Feedback — every role reads (STAFF has a read-only feedback list, §8).
-- Nobody writes: the kiosk inserts through the service role, and feedback.status
-- is trigger-maintained. No INSERT/UPDATE/DELETE policy exists, so all three are
-- denied for authenticated by default.
-- -----------------------------------------------------------------------------

create policy feedback_select_member on feedback for select to authenticated
  using (outlet_id = aic_current_outlet() and aic_is_member());

do $$
declare
  t text;
begin
  foreach t in array array['feedback_ratings', 'feedback_issues', 'feedback_themes']
  loop
    execute format(
      'create policy %1$s_select_member on %1$s for select to authenticated
         using (
           aic_is_member()
           and exists (
             select 1 from feedback f
             where f.feedback_id = %1$s.feedback_id and f.outlet_id = aic_current_outlet()
           )
         )', t);
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- Follow-ups — the §8 line that matters: STAFF sees ONLY their own assignments.
-- -----------------------------------------------------------------------------

create policy follow_ups_select_scoped on follow_ups for select to authenticated
  using (
    outlet_id = aic_current_outlet()
    and (
      aic_is_manager_plus()
      or (aic_has_role('STAFF') and assigned_to = auth.uid())
    )
  );

create policy follow_ups_insert_manager on follow_ups for insert to authenticated
  with check (outlet_id = aic_current_outlet() and aic_is_manager_plus());

create policy follow_ups_update_scoped on follow_ups for update to authenticated
  using (
    outlet_id = aic_current_outlet()
    and (
      aic_is_manager_plus()
      or (aic_has_role('STAFF') and assigned_to = auth.uid())
    )
  )
  with check (outlet_id = aic_current_outlet());

create policy follow_up_notes_select_scoped on follow_up_notes for select to authenticated
  using (
    exists (
      select 1 from follow_ups f
      where f.follow_up_id = follow_up_notes.follow_up_id
        and f.outlet_id = aic_current_outlet()
        and (
          aic_is_manager_plus()
          or (aic_has_role('STAFF') and f.assigned_to = auth.uid())
        )
    )
  );

create policy follow_up_notes_insert_scoped on follow_up_notes for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from follow_ups f
      where f.follow_up_id = follow_up_notes.follow_up_id
        and f.outlet_id = aic_current_outlet()
        and (
          aic_is_manager_plus()
          or (aic_has_role('STAFF') and f.assigned_to = auth.uid())
        )
    )
  );

-- Notes are an append-only record. No update, no delete policy, on purpose.

-- -----------------------------------------------------------------------------
-- Alerts and audit log
-- -----------------------------------------------------------------------------

create policy alerts_select_manager on alerts for select to authenticated
  using (outlet_id = aic_current_outlet() and aic_is_manager_plus());

create policy alerts_ack_manager on alerts for update to authenticated
  using (outlet_id = aic_current_outlet() and aic_is_manager_plus())
  with check (outlet_id = aic_current_outlet());

-- The audit log is evidence: OWNER/ADMIN may read it, nobody may write it by
-- hand. Entries come from SECURITY DEFINER functions and the service role.
create policy audit_log_select_admin on audit_log for select to authenticated
  using (outlet_id = aic_current_outlet() and aic_is_config_owner());

-- -----------------------------------------------------------------------------
-- guests_visible — the only guest read path for the whole admin app.
--
-- SECURITY DEFINER view: it reads the guests table on the caller's behalf and
-- applies both the outlet scope and the §11 masking rule itself. STAFF can see
-- that a feedback belongs to "Asha" without ever receiving her number.
-- -----------------------------------------------------------------------------

create view guests_visible
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
  g.updated_at
from guests g
where g.outlet_id = aic_current_outlet()
  and aic_is_member();

-- Supabase grants default privileges on new objects to anon; take them back.
revoke all on guests_visible from anon, public;
grant select on guests_visible to authenticated;

comment on view guests_visible is
  'Masked guest directory. Every admin surface reads guests through this view; '
  'the raw table is MANAGER+ only and the unmasked number requires aic_reveal_phone().';

-- -----------------------------------------------------------------------------
-- aic_reveal_phone — the ONLY way to obtain an unmasked number, and it always
-- costs an audit_log row (§11).
-- -----------------------------------------------------------------------------

create or replace function aic_reveal_phone(p_guest uuid, p_reason text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone  text;
  v_outlet uuid;
  v_role   text;
begin
  v_role   := aic_current_role();
  v_outlet := aic_current_outlet();

  if v_role is null then
    raise exception 'Not signed in';
  end if;

  -- §11: guest profile is MANAGER+. STAFF may see a number only for a follow-up
  -- assigned to them.
  if v_role not in ('OWNER', 'ADMIN', 'MANAGER') then
    if not exists (
      select 1 from follow_ups f
      where f.guest_id = p_guest
        and f.assigned_to = auth.uid()
        and f.outlet_id = v_outlet
    ) then
      raise exception 'Not permitted to reveal this guest phone number';
    end if;
  end if;

  select phone into v_phone
  from guests
  where guest_id = p_guest and outlet_id = v_outlet;

  if v_phone is null then
    return null;
  end if;

  insert into audit_log (outlet_id, user_id, action, entity, entity_id, after)
  values (
    v_outlet, auth.uid(), 'PHONE_REVEAL', 'guests', p_guest::text,
    jsonb_build_object('role', v_role, 'reason', p_reason)
  );

  return v_phone;
end;
$$;

revoke all on function aic_reveal_phone(uuid, text) from public, anon;
grant execute on function aic_reveal_phone(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Anonymous callers must be able to execute nothing that reads data.
-- -----------------------------------------------------------------------------

revoke execute on function aic_current_outlet() from anon;
revoke execute on function aic_current_role() from anon;
revoke execute on function aic_mask_phone(text, int) from anon;
