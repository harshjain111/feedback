-- =============================================================================
-- 0011_rating_distribution.sql — how the five faces were actually pressed
--
-- The dashboard shows averages everywhere, and an average hides its own shape:
-- 3.0 is forty guests who felt nothing and 3.0 is twenty delighted guests plus
-- twenty furious ones, and those two cafés need opposite decisions. The donut on
-- the dashboard reads from this.
--
-- Grouped in Postgres, like every other rollup (§9) — the alternative is pulling
-- one row per rated category into Node to count them, which is exactly what
-- v_rating_facts exists to prevent.
-- =============================================================================

create view v_rating_distribution_daily
with (security_invoker = true)
as
select
  outlet_id,
  local_date,
  rating,
  count(*) as rating_count
from v_rating_facts
group by outlet_id, local_date, rating;

comment on view v_rating_distribution_daily is
  'Ratings per value per day. The shape behind the average (§25).';

revoke all on v_rating_distribution_daily from anon, public;
grant select on v_rating_distribution_daily to authenticated;
