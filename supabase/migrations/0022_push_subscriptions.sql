-- 0022_push_subscriptions.sql
--
-- Web Push endpoints, one row per browser-on-device that has opted in.
--
-- The client asked for a notification on a phone the moment a guest rates
-- anything below 3. The detection already exists — evaluateAlerts() raises a
-- LOW_RATING alert on submit (§27) — but an alert only appears to someone who
-- already has the dashboard open. This is the delivery half.
--
-- A subscription is not a user: one person may have the admin installed on a
-- phone and open in a desktop browser, and each of those is its own endpoint
-- with its own keys. `endpoint` is therefore the natural key, and it is unique
-- globally rather than per user, because the push service will reissue the same
-- endpoint to whoever re-subscribes on that browser profile.

create table if not exists push_subscriptions (
  subscription_id uuid primary key default gen_random_uuid(),
  outlet_id       uuid not null references outlets(outlet_id) on delete cascade,
  user_id         uuid not null references app_users(user_id) on delete cascade,

  -- The three fields a Web Push send needs, exactly as the browser hands them
  -- over from PushSubscription.toJSON().
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,

  -- For the settings screen: "Chrome on Android, added 3 days ago" is the only
  -- way someone can tell which of four rows is the phone in their pocket.
  user_agent      text,
  label           text,

  created_at      timestamptz not null default now(),
  last_used_at    timestamptz,

  -- A push service returns 404/410 when an endpoint is dead. We delete on those
  -- immediately; this counts the soft failures so a permanently broken row does
  -- not get retried forever.
  failure_count   int not null default 0
);

create index if not exists push_subscriptions_outlet_idx
  on push_subscriptions (outlet_id) where failure_count < 5;
create index if not exists push_subscriptions_user_idx
  on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Supabase grants defaults to anon on new tables; take them back. The kiosk is
-- anonymous and has no business reading who gets notified.
revoke all on push_subscriptions from anon, public;
grant select, insert, update, delete on push_subscriptions to authenticated;

-- A signed-in user sees and manages ONLY their own devices. Not the outlet's —
-- an endpoint plus its keys is enough to push to somebody else's phone, so this
-- is deliberately narrower than the rest of the admin's read model.
create policy push_subscriptions_own_select on push_subscriptions
  for select to authenticated
  using (user_id = auth.uid() and outlet_id = aic_current_outlet());

create policy push_subscriptions_own_insert on push_subscriptions
  for insert to authenticated
  with check (user_id = auth.uid() and outlet_id = aic_current_outlet() and aic_is_member());

create policy push_subscriptions_own_update on push_subscriptions
  for update to authenticated
  using (user_id = auth.uid() and outlet_id = aic_current_outlet())
  with check (user_id = auth.uid() and outlet_id = aic_current_outlet());

create policy push_subscriptions_own_delete on push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid() and outlet_id = aic_current_outlet());

comment on table push_subscriptions is
  'Web Push endpoints for admin users. A row is a browser on a device, not a '
  'person. Readable only by its owner: endpoint + keys can push to that phone.';
