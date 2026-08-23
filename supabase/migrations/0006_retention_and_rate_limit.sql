-- =============================================================================
-- 0006_retention_and_rate_limit.sql — the two §42 gaps
--
--  1. A retention purge. §11 requires the setting AND the job to exist, even
--     though the default is to keep everything.
--  2. A rate limit for the kiosk write path, so a scripted POST cannot fill the
--     table.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Retention purge (§11, §45)
--
-- Purges CONTACT DETAILS, not feedback. A guest exercising their right to be
-- forgotten should disappear as a person; their rating of the food is not
-- personal data and deleting it would silently rewrite the café's history.
-- So the guest row is anonymised and the feedback stays, detached.
--
-- Driven by privacy.retention_days. Null means keep indefinitely, which is the
-- shipped default, and the function does nothing at all in that case.
-- -----------------------------------------------------------------------------
create or replace function aic_purge_expired_contacts(p_outlet uuid default null)
returns table (outlet_id uuid, guests_anonymised int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outlet   uuid;
  v_days     int;
  v_affected int;
begin
  for v_outlet in
    select o.outlet_id from outlets o
    where p_outlet is null or o.outlet_id = p_outlet
  loop
    select (value #>> '{}')::int into v_days
    from app_config
    where app_config.outlet_id = v_outlet and key = 'privacy.retention_days';

    -- Null or absent means "retain indefinitely" (§11). Do nothing.
    if v_days is null or v_days <= 0 then
      continue;
    end if;

    with expired as (
      update guests g
      set name  = null,
          phone = null,
          updated_at = now()
      where g.outlet_id = v_outlet
        and g.phone is not null
        and coalesce(g.last_feedback_date, g.first_feedback_date)
              < (now() at time zone 'Asia/Kolkata')::date - v_days
      returning g.guest_id
    )
    select count(*) into v_affected from expired;

    if v_affected > 0 then
      insert into audit_log (outlet_id, action, entity, entity_id, after)
      values (
        v_outlet, 'RETENTION_PURGE', 'guests', null,
        jsonb_build_object('retention_days', v_days, 'guests_anonymised', v_affected)
      );
    end if;

    outlet_id := v_outlet;
    guests_anonymised := coalesce(v_affected, 0);
    return next;
  end loop;
end;
$$;

comment on function aic_purge_expired_contacts(uuid) is
  'Anonymises guest contact details past privacy.retention_days. Feedback is never deleted.';

revoke all on function aic_purge_expired_contacts(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Kiosk write rate limit (§42)
--
-- A counter per (kiosk, minute) rather than an IP allowlist: the kiosk is a
-- tablet on a café's shared connection, so IP tells us nothing useful, and the
-- thing worth bounding is how fast one terminal can write.
--
-- Returns true when the caller is within budget. The insert-then-check shape
-- means concurrent requests cannot both see a stale count.
-- -----------------------------------------------------------------------------
create table kiosk_write_budget (
  outlet_id  uuid not null references outlets (outlet_id) on delete cascade,
  kiosk_key  text not null,
  minute     timestamptz not null,
  hits       int not null default 0,
  primary key (outlet_id, kiosk_key, minute)
);

create index kiosk_write_budget_minute_idx on kiosk_write_budget (minute);

alter table kiosk_write_budget enable row level security;
revoke all on kiosk_write_budget from anon, authenticated;

create or replace function aic_consume_write_budget(
  p_outlet uuid,
  p_kiosk_key text,
  p_limit int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minute timestamptz := date_trunc('minute', now());
  v_hits   int;
begin
  insert into kiosk_write_budget (outlet_id, kiosk_key, minute, hits)
  values (p_outlet, p_kiosk_key, v_minute, 1)
  on conflict (outlet_id, kiosk_key, minute)
    do update set hits = kiosk_write_budget.hits + 1
  returning hits into v_hits;

  -- Opportunistic cleanup: this table is scratch space, not a record.
  delete from kiosk_write_budget where minute < now() - interval '1 hour';

  return v_hits <= p_limit;
end;
$$;

revoke all on function aic_consume_write_budget(uuid, text, int) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- The new setting, seeded for every existing outlet.
--
-- It goes here rather than into 0002 because that migration has already been
-- applied — editing an applied migration would leave the repo and the database
-- claiming different things, which scripts/migrate.mjs refuses by checksum.
-- -----------------------------------------------------------------------------
insert into app_config (outlet_id, key, section, value)
select outlet_id, 'kiosk.max_writes_per_minute', 'kiosk', '15'::jsonb
from outlets
on conflict (outlet_id, key) do nothing;
