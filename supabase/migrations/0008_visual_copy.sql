-- =============================================================================
-- 0008_visual_copy.sql
--
-- Two strings the rebuilt screens introduced. They are customer-facing, so §3
-- says they belong in app_config, not in a component — even short helper lines.
--
-- Neither is in the §5 locked copy, so both are authored and flagged as such:
-- the client should review the wording.
-- =============================================================================

insert into app_config (outlet_id, key, section, value)
select outlet_id, 'negative.chips_hint', 'negative',
       to_jsonb($q$Select what needs improvement — you can choose more than one.$q$::text)
from outlets
on conflict (outlet_id, key) do nothing;

insert into app_config (outlet_id, key, section, value)
select outlet_id, 'followup.yes_sub', 'followup',
       to_jsonb($q$I would like to hear from you$q$::text)
from outlets
on conflict (outlet_id, key) do nothing;
