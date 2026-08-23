-- =============================================================================
-- 0001_core_schema.sql — All India Café CXIS
-- Implements CLAUDE.md §7 in full.
--
-- Every table carries outlet_id, including the reference tables. §43 (multi-
-- outlet readiness) depends on it: a second café must be able to diverge on
-- copy, categories, colours and thresholds without a migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Kolkata service-hour bucket. Mirrors lib/time.ts hourBucket() exactly — §33
-- analysis reads this column, so the two implementations must not drift.
create or replace function aic_hour_bucket(p_at timestamptz)
returns text
language sql
immutable
as $$
  select case
    when h >= 12 and h < 15 then '12-15'
    when h >= 15 and h < 18 then '15-18'
    when h >= 18 and h < 21 then '18-21'
    when h >= 21 and h < 24 then '21-24'
    else 'other'
  end
  from (select extract(hour from (p_at at time zone 'Asia/Kolkata'))::int as h) t;
$$;

comment on function aic_hour_bucket(timestamptz) is
  'Kolkata hour bucket for §33. Keep in sync with hourBucket() in lib/time.ts.';

create or replace function aic_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Outlets and kiosks
-- -----------------------------------------------------------------------------

create table outlets (
  outlet_id   uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null unique,
  city        text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table kiosks (
  kiosk_id      uuid primary key default gen_random_uuid(),
  outlet_id     uuid not null references outlets (outlet_id) on delete restrict,
  label         text not null,
  active        boolean not null default true,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index kiosks_outlet_idx on kiosks (outlet_id);

-- -----------------------------------------------------------------------------
-- Reference tables — all CMS-editable, all per-outlet (§3)
-- -----------------------------------------------------------------------------

create table categories (
  category_id    uuid primary key default gen_random_uuid(),
  outlet_id      uuid not null references outlets (outlet_id) on delete restrict,
  name           text not null,
  question       text not null,
  icon           text not null,
  display_order  int not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index categories_outlet_order_idx on categories (outlet_id, display_order);

create table issues (
  issue_id       uuid primary key default gen_random_uuid(),
  outlet_id      uuid not null references outlets (outlet_id) on delete restrict,
  name           text not null,
  icon           text,
  kind           text not null check (kind in ('negative', 'positive')),
  display_order  int not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index issues_outlet_kind_order_idx on issues (outlet_id, kind, display_order);

create table rating_scale (
  scale_id   uuid primary key default gen_random_uuid(),
  outlet_id  uuid not null references outlets (outlet_id) on delete restrict,
  value      int not null check (value between 1 and 5),
  face_key   text not null check (face_key in ('angry', 'sad', 'neutral', 'happy', 'delighted')),
  label      text not null,
  colour     text not null check (colour ~* '^#[0-9a-f]{6}$'),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rating_scale_outlet_value_key unique (outlet_id, value)
);

-- The comment-intelligence lexicon (§9). Data, never a TypeScript constant.
create table themes (
  theme_id       uuid primary key default gen_random_uuid(),
  outlet_id      uuid not null references outlets (outlet_id) on delete restrict,
  name           text not null,
  kind           text not null check (kind in ('negative', 'positive')),
  display_order  int not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Scoped by kind: "Cleanliness" as praise and "Cleanliness" as a complaint
  -- are different themes and must both be able to exist.
  constraint themes_outlet_kind_name_key unique (outlet_id, kind, name)
);

create index themes_outlet_kind_idx on themes (outlet_id, kind, display_order);

create table theme_keywords (
  keyword_id  uuid primary key default gen_random_uuid(),
  theme_id    uuid not null references themes (theme_id) on delete cascade,
  keyword     text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create unique index theme_keywords_theme_keyword_key
  on theme_keywords (theme_id, lower(keyword));
create index theme_keywords_theme_idx on theme_keywords (theme_id);

-- -----------------------------------------------------------------------------
-- Users (mirrors auth.users, adds outlet + role)
-- -----------------------------------------------------------------------------

create table app_users (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  outlet_id   uuid not null references outlets (outlet_id) on delete restrict,
  name        text not null,
  email       text not null,
  role        text not null check (role in ('OWNER', 'ADMIN', 'MANAGER', 'STAFF')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index app_users_outlet_idx on app_users (outlet_id);
create unique index app_users_outlet_email_key on app_users (outlet_id, lower(email));

-- -----------------------------------------------------------------------------
-- Guests — phone is the unique guest key (§7)
-- -----------------------------------------------------------------------------

create table guests (
  guest_id             uuid primary key default gen_random_uuid(),
  outlet_id            uuid not null references outlets (outlet_id) on delete restrict,
  guest_code           text not null,
  name                 text,
  phone                text,
  first_feedback_date  date,
  last_feedback_date   date,
  total_feedbacks      int not null default 0,
  average_rating       numeric(3, 2),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index guests_outlet_code_key on guests (outlet_id, guest_code);
-- Phone is nullable (collection is always optional, §11) but unique when given.
create unique index guests_outlet_phone_key on guests (outlet_id, phone)
  where phone is not null;

create trigger guests_touch_updated_at
  before update on guests
  for each row execute function aic_touch_updated_at();

-- -----------------------------------------------------------------------------
-- Feedback
-- -----------------------------------------------------------------------------

create table feedback (
  feedback_id          uuid primary key default gen_random_uuid(),
  feedback_code        text not null,
  outlet_id            uuid not null references outlets (outlet_id) on delete restrict,
  kiosk_id             uuid references kiosks (kiosk_id) on delete set null,
  guest_id             uuid references guests (guest_id) on delete set null,

  -- Idempotency key (§7). Defaulted so a row is never without one; the kiosk
  -- supplies its own so a double-tap or an offline retry collapses to one row.
  submission_id        uuid not null default gen_random_uuid(),

  submitted_at         timestamptz not null default now(),

  -- Denormalised Kolkata stamps. Every dashboard query filters on these, never
  -- on raw UTC. The app supplies them via lib/time.ts; anything left null is
  -- derived from submitted_at by aic_prepare_feedback_row(). They are NOT given
  -- column defaults of now(): a default cannot see submitted_at, so a row with a
  -- back-dated submitted_at would get today's local_date and the two would
  -- silently disagree.
  local_date           date not null,
  local_time           time not null,
  day_of_week          int  not null check (day_of_week between 0 and 6),
  hour_bucket          text not null
                            check (hour_bucket in ('12-15', '15-18', '18-21', '21-24', 'other')),

  overall_score        numeric(3, 2) check (overall_score between 1 and 5),
  sentiment            text check (sentiment in ('positive', 'neutral', 'negative')),
  comment              text,
  follow_up_requested  boolean not null default false,

  -- DENORMALISED MIRROR of follow_ups.status. Maintained by trigger only —
  -- see aic_mirror_follow_up_status() below. Never write this from app code.
  status               text not null default 'NEW'
                            check (status in ('NEW', 'OPEN', 'CONTACTED', 'RESOLVED', 'CLOSED')),

  created_at           timestamptz not null default now(),

  constraint feedback_outlet_submission_key unique (outlet_id, submission_id),
  constraint feedback_outlet_code_key unique (outlet_id, feedback_code)
);

comment on column feedback.status is
  'Denormalised mirror of follow_ups.status. Trigger-maintained; app code must not write it.';
comment on column feedback.submission_id is
  'Client-generated idempotency key. POST /api/feedback returns the existing row on conflict.';

create index feedback_outlet_date_idx on feedback (outlet_id, local_date desc);
create index feedback_outlet_status_idx on feedback (outlet_id, status);
create index feedback_guest_idx on feedback (guest_id) where guest_id is not null;
create index feedback_outlet_submitted_idx on feedback (outlet_id, submitted_at desc);
create index feedback_outlet_bucket_idx on feedback (outlet_id, hour_bucket);
create index feedback_outlet_dow_idx on feedback (outlet_id, day_of_week);
create index feedback_outlet_followup_idx on feedback (outlet_id, follow_up_requested)
  where follow_up_requested;

create table feedback_ratings (
  feedback_id  uuid not null references feedback (feedback_id) on delete cascade,
  category_id  uuid not null references categories (category_id) on delete restrict,
  rating       int not null check (rating between 1 and 5),
  primary key (feedback_id, category_id)
);

create index feedback_ratings_category_idx on feedback_ratings (category_id);
create index feedback_ratings_category_rating_idx on feedback_ratings (category_id, rating);

create table feedback_issues (
  feedback_id  uuid not null references feedback (feedback_id) on delete cascade,
  issue_id     uuid not null references issues (issue_id) on delete restrict,
  primary key (feedback_id, issue_id)
);

create index feedback_issues_issue_idx on feedback_issues (issue_id);

-- Theme matches, written at submit time so §26 aggregates in Postgres rather
-- than re-scanning comment text. feedback.comment is never modified.
create table feedback_themes (
  feedback_id  uuid not null references feedback (feedback_id) on delete cascade,
  theme_id     uuid not null references themes (theme_id) on delete cascade,
  mentions     int not null default 1 check (mentions > 0),
  primary key (feedback_id, theme_id)
);

create index feedback_themes_theme_idx on feedback_themes (theme_id);

-- -----------------------------------------------------------------------------
-- Follow-up workflow (§28) — the source of truth for status
-- -----------------------------------------------------------------------------

create table follow_ups (
  follow_up_id  uuid primary key default gen_random_uuid(),
  outlet_id     uuid not null references outlets (outlet_id) on delete restrict,
  feedback_id   uuid not null unique references feedback (feedback_id) on delete cascade,
  guest_id      uuid references guests (guest_id) on delete set null,
  status        text not null default 'OPEN'
                     check (status in ('OPEN', 'CONTACTED', 'RESOLVED', 'CLOSED')),
  assigned_to   uuid references app_users (user_id) on delete set null,
  resolution    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index follow_ups_outlet_status_idx on follow_ups (outlet_id, status);
create index follow_ups_assigned_idx on follow_ups (assigned_to) where assigned_to is not null;
create index follow_ups_guest_idx on follow_ups (guest_id) where guest_id is not null;

create trigger follow_ups_touch_updated_at
  before update on follow_ups
  for each row execute function aic_touch_updated_at();

-- Append-only note thread. §28 requires author + timestamp per note, which a
-- single text column cannot carry.
create table follow_up_notes (
  note_id       uuid primary key default gen_random_uuid(),
  follow_up_id  uuid not null references follow_ups (follow_up_id) on delete cascade,
  author_id     uuid references app_users (user_id) on delete set null,
  body          text not null check (length(btrim(body)) > 0),
  created_at    timestamptz not null default now()
);

create index follow_up_notes_follow_up_idx on follow_up_notes (follow_up_id, created_at);

-- -----------------------------------------------------------------------------
-- Config, alerts, audit
-- -----------------------------------------------------------------------------

create table app_config (
  outlet_id   uuid not null references outlets (outlet_id) on delete restrict,
  key         text not null,
  section     text not null,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references app_users (user_id) on delete set null,
  primary key (outlet_id, key)
);

create index app_config_outlet_section_idx on app_config (outlet_id, section);

create trigger app_config_touch_updated_at
  before update on app_config
  for each row execute function aic_touch_updated_at();

create table alerts (
  alert_id         uuid primary key default gen_random_uuid(),
  outlet_id        uuid not null references outlets (outlet_id) on delete restrict,
  type             text not null,
  severity         text not null default 'warning'
                        check (severity in ('info', 'warning', 'critical')),
  -- Stable key per live condition, e.g. LOW_RATING_CLUSTER:service:2026-08-23T19
  dedupe_key       text not null,
  title            text not null,
  body             text,
  payload          jsonb not null default '{}'::jsonb,
  first_fired_at   timestamptz not null default now(),
  last_fired_at    timestamptz not null default now(),
  cooldown_until   timestamptz,
  acknowledged_at  timestamptz,
  acknowledged_by  uuid references app_users (user_id) on delete set null,
  created_at       timestamptz not null default now()
);

-- One open row per live condition. A re-fire inside the cooldown updates
-- last_fired_at instead of inserting; acknowledging frees the key to fire again.
create unique index alerts_outlet_dedupe_open_key
  on alerts (outlet_id, dedupe_key)
  where acknowledged_at is null;

create index alerts_outlet_open_idx on alerts (outlet_id, last_fired_at desc)
  where acknowledged_at is null;

create table audit_log (
  id          bigserial primary key,
  outlet_id   uuid references outlets (outlet_id) on delete set null,
  user_id     uuid references app_users (user_id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_outlet_created_idx on audit_log (outlet_id, created_at desc);
create index audit_log_entity_idx on audit_log (entity, entity_id);

-- -----------------------------------------------------------------------------
-- Code generators
--
-- A plain SEQUENCE cannot reset per day without a scheduled job, and per-outlet
-- sequences would need DDL for every new outlet. This counter table is the same
-- contract — a single atomic increment per call — and handles both cases.
-- -----------------------------------------------------------------------------

create table code_counters (
  outlet_id   uuid not null references outlets (outlet_id) on delete cascade,
  scope       text not null check (scope in ('guest', 'feedback')),
  bucket      text not null,          -- '' for guests, 'YYYYMMDD' for feedback
  last_value  bigint not null default 0,
  primary key (outlet_id, scope, bucket)
);

create or replace function aic_next_counter(p_outlet uuid, p_scope text, p_bucket text)
returns bigint
language plpgsql
as $$
declare
  v_next bigint;
begin
  insert into code_counters (outlet_id, scope, bucket, last_value)
  values (p_outlet, p_scope, p_bucket, 1)
  on conflict (outlet_id, scope, bucket)
    do update set last_value = code_counters.last_value + 1
  returning last_value into v_next;

  return v_next;
end;
$$;

-- AIC-000001
create or replace function aic_next_guest_code(p_outlet uuid)
returns text
language plpgsql
as $$
declare
  v_prefix text;
begin
  select code into v_prefix from outlets where outlet_id = p_outlet;
  if v_prefix is null then
    raise exception 'Unknown outlet %', p_outlet;
  end if;

  return v_prefix || '-' || lpad(aic_next_counter(p_outlet, 'guest', '')::text, 6, '0');
end;
$$;

-- AIC-20260823-00125 — the counter resets each Kolkata day.
create or replace function aic_next_feedback_code(p_outlet uuid, p_at timestamptz default now())
returns text
language plpgsql
as $$
declare
  v_prefix text;
  v_bucket text;
begin
  select code into v_prefix from outlets where outlet_id = p_outlet;
  if v_prefix is null then
    raise exception 'Unknown outlet %', p_outlet;
  end if;

  v_bucket := to_char(p_at at time zone 'Asia/Kolkata', 'YYYYMMDD');

  return v_prefix || '-' || v_bucket || '-'
      || lpad(aic_next_counter(p_outlet, 'feedback', v_bucket)::text, 5, '0');
end;
$$;

-- Fill in the code and any missing Kolkata stamp so no insert path can forget
-- one, and so every derived value comes from the same instant: submitted_at.
create or replace function aic_prepare_feedback_row()
returns trigger
language plpgsql
as $$
declare
  v_at    timestamptz;
  v_local timestamp;
begin
  new.submitted_at := coalesce(new.submitted_at, now());
  v_at    := new.submitted_at;
  v_local := v_at at time zone 'Asia/Kolkata';

  if new.feedback_code is null or btrim(new.feedback_code) = '' then
    new.feedback_code := aic_next_feedback_code(new.outlet_id, v_at);
  end if;

  new.local_date  := coalesce(new.local_date, v_local::date);
  new.local_time  := coalesce(new.local_time, v_local::time);
  new.day_of_week := coalesce(new.day_of_week, extract(dow from v_local)::int);
  new.hour_bucket := coalesce(new.hour_bucket, aic_hour_bucket(v_at));

  return new;
end;
$$;

-- A BEFORE INSERT trigger runs before column constraints are evaluated, so the
-- columns can stay NOT NULL while the trigger fills them.
create trigger feedback_prepare_row
  before insert on feedback
  for each row execute function aic_prepare_feedback_row();

create or replace function aic_assign_guest_code()
returns trigger
language plpgsql
as $$
begin
  if new.guest_code is null or btrim(new.guest_code) = '' then
    new.guest_code := aic_next_guest_code(new.outlet_id);
  end if;
  return new;
end;
$$;

create trigger guests_assign_code
  before insert on guests
  for each row execute function aic_assign_guest_code();

-- -----------------------------------------------------------------------------
-- Trigger 1 — guest aggregates (§7). Never recomputed in app code.
--
-- Recomputes from the feedback table for the affected guest rather than
-- incrementing counters: correct under insert, update, delete and re-parenting
-- (an anonymous feedback later attached to a guest), at the cost of one indexed
-- scan over that guest's rows.
-- -----------------------------------------------------------------------------

create or replace function aic_recalc_guest_aggregates(p_guest uuid)
returns void
language plpgsql
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
    select count(*)            as cnt,
           round(avg(overall_score), 2) as avg_score,
           min(local_date)     as first_date,
           max(local_date)     as last_date
    from feedback
    where guest_id = p_guest
  ) s
  where g.guest_id = p_guest;
end;
$$;

create or replace function aic_feedback_guest_aggregates()
returns trigger
language plpgsql
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

create trigger feedback_guest_aggregates
  after insert or update of guest_id, overall_score, local_date or delete on feedback
  for each row execute function aic_feedback_guest_aggregates();

-- -----------------------------------------------------------------------------
-- Trigger 2 — status mirror (§7). follow_ups.status is the source of truth.
-- -----------------------------------------------------------------------------

create or replace function aic_mirror_follow_up_status()
returns trigger
language plpgsql
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

  -- Open the gate for the guard trigger below, for this statement only.
  perform set_config('aic.status_mirror', 'on', true);

  update feedback
  set status = v_status
  where feedback_id = v_feedback
    and status is distinct from v_status;

  perform set_config('aic.status_mirror', 'off', true);

  return null;
end;
$$;

create trigger follow_ups_mirror_status
  after insert or update of status or delete on follow_ups
  for each row execute function aic_mirror_follow_up_status();

-- Guard: reject any other writer of feedback.status. Without this the mirror is
-- a convention, and conventions drift.
create or replace function aic_guard_feedback_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('aic.status_mirror', true), 'off') <> 'on' then
    raise exception 'feedback.status is a denormalised mirror of follow_ups.status (CLAUDE.md 7). Update the follow_ups row instead.';
  end if;
  return new;
end;
$$;

create trigger feedback_guard_status
  before update of status on feedback
  for each row execute function aic_guard_feedback_status();

-- -----------------------------------------------------------------------------
-- Kiosk heartbeat (§43) — used by Prompt 43's online/offline badge.
-- -----------------------------------------------------------------------------

create or replace function aic_touch_kiosk(p_kiosk uuid)
returns void
language sql
as $$
  update kiosks set last_seen_at = now() where kiosk_id = p_kiosk;
$$;
