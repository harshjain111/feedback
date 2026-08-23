-- =============================================================================
-- 0004_aggregate_views.sql — aggregation lives in Postgres, not in Node
--
-- Every view below is `security_invoker = true` ON PURPOSE. The default in
-- Postgres 15+ runs a view as its owner, which would quietly bypass the RLS on
-- the tables underneath and hand a STAFF user the whole outlet's numbers. With
-- security_invoker the caller's policies still apply, so the §8 matrix holds
-- through the analytics layer exactly as it does through the raw tables.
--
-- (guests_visible in 0003 is the deliberate exception: it is a definer view
-- precisely because its job is to expose a masked projection of rows the caller
-- cannot otherwise read.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The fact table for rating analysis.
--
-- One row per (feedback, category). Everything §24, §33 and §34 need to group
-- by — date, day of week, hour bucket, category — is already denormalised onto
-- feedback, so no join to a calendar is required and no query has to touch UTC.
-- -----------------------------------------------------------------------------
create view v_rating_facts
with (security_invoker = true)
as
select
  f.outlet_id,
  f.feedback_id,
  f.guest_id,
  f.local_date,
  f.day_of_week,
  f.hour_bucket,
  f.sentiment,
  f.follow_up_requested,
  r.category_id,
  r.rating
from feedback f
join feedback_ratings r on r.feedback_id = f.feedback_id;

comment on view v_rating_facts is
  'One row per rated category per feedback. Group by any dimension §24/§33/§34 needs.';

-- -----------------------------------------------------------------------------
-- Daily rollups
-- -----------------------------------------------------------------------------

create view v_feedback_daily
with (security_invoker = true)
as
select
  f.outlet_id,
  f.local_date,
  count(*)                                                    as feedback_count,
  round(avg(f.overall_score), 2)                              as avg_score,
  count(*) filter (where f.sentiment = 'positive')            as positive_count,
  count(*) filter (where f.sentiment = 'neutral')             as neutral_count,
  count(*) filter (where f.sentiment = 'negative')            as negative_count,
  count(*) filter (where f.follow_up_requested)               as follow_up_count,
  count(*) filter (where f.comment is not null)               as comment_count,
  count(distinct f.guest_id)                                  as identified_guest_count
from feedback f
group by f.outlet_id, f.local_date;

create view v_category_daily
with (security_invoker = true)
as
select
  outlet_id,
  local_date,
  category_id,
  count(*)                                    as rating_count,
  round(avg(rating), 2)                       as avg_rating,
  count(*) filter (where rating >= 4)         as positive_count,
  count(*) filter (where rating = 3)          as neutral_count,
  count(*) filter (where rating <= 2)         as negative_count
from v_rating_facts
group by outlet_id, local_date, category_id;

create view v_issue_daily
with (security_invoker = true)
as
select
  f.outlet_id,
  f.local_date,
  fi.issue_id,
  count(*) as mention_count
from feedback_issues fi
join feedback f on f.feedback_id = fi.feedback_id
group by f.outlet_id, f.local_date, fi.issue_id;

create view v_theme_daily
with (security_invoker = true)
as
select
  f.outlet_id,
  f.local_date,
  ft.theme_id,
  count(*)          as feedback_count,
  sum(ft.mentions)  as mention_count
from feedback_themes ft
join feedback f on f.feedback_id = ft.feedback_id
group by f.outlet_id, f.local_date, ft.theme_id;

-- -----------------------------------------------------------------------------
-- Follow-up pipeline (§9: resolution rate, average resolution time)
--
-- resolution_hours is null for anything unresolved. That is the point: an open
-- follow-up has no resolution time, and counting it as zero would make a
-- backlog look like fast service.
-- -----------------------------------------------------------------------------
create view v_follow_up_facts
with (security_invoker = true)
as
select
  fu.outlet_id,
  fu.follow_up_id,
  fu.feedback_id,
  fu.guest_id,
  fu.status,
  fu.assigned_to,
  f.local_date,
  fu.created_at,
  fu.resolved_at,
  case
    when fu.resolved_at is null then null
    else round(extract(epoch from (fu.resolved_at - fu.created_at)) / 3600.0, 2)
  end as resolution_hours
from follow_ups fu
join feedback f on f.feedback_id = fu.feedback_id;

-- -----------------------------------------------------------------------------
-- Guest summary (§29–§31)
--
-- The aggregates themselves are trigger-maintained on `guests`; this view adds
-- the derived classifications the guest list filters on, so their definitions
-- live in one place instead of being re-expressed in each query.
-- -----------------------------------------------------------------------------
create view v_guest_summary
with (security_invoker = true)
as
select
  g.guest_id,
  g.outlet_id,
  g.guest_code,
  g.name,
  g.total_feedbacks,
  g.average_rating,
  g.first_feedback_date,
  g.last_feedback_date,
  (g.phone is not null)                              as has_phone,
  (g.total_feedbacks > 1)                            as is_repeat,
  (g.average_rating is not null
     and g.average_rating <= 2.5)                    as is_negative,
  (g.total_feedbacks >= 3)                           as is_high_engagement,
  exists (
    select 1 from follow_ups fu
    where fu.guest_id = g.guest_id and fu.status <> 'CLOSED'
  )                                                  as has_open_follow_up
from guests g;

comment on view v_guest_summary is
  'Guest list classifications (§32). Definitions live here, not re-expressed per query.';

-- -----------------------------------------------------------------------------
-- Grants. RLS still applies through security_invoker, so these grant reach,
-- not access.
-- -----------------------------------------------------------------------------
revoke all on
  v_rating_facts, v_feedback_daily, v_category_daily, v_issue_daily,
  v_theme_daily, v_follow_up_facts, v_guest_summary
from anon, public;

grant select on
  v_rating_facts, v_feedback_daily, v_category_daily, v_issue_daily,
  v_theme_daily, v_follow_up_facts, v_guest_summary
to authenticated;
