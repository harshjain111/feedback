-- =============================================================================
-- 0012_contact_cta_hint.sql — the line under a dimmed KEEP ME CONNECTED
--
-- The primary button used to work on an empty form, which was a promise the
-- system could not keep: guest resolution keys on the phone number (§7), so a
-- submission with no number stores no guest at all. A guest who tapped it
-- believed they had connected and had not.
--
-- The button is now enabled only once a valid number is present. That is not a
-- required field — SKIP sits directly beneath it, full size, always live (§4,
-- §5). This string explains the dimming, so the button never looks broken.
--
-- Authored, not from §5 — the brief has no copy for a state it did not
-- anticipate. It is CMS-editable like every other string (§3).
-- =============================================================================

insert into app_config (outlet_id, key, section, value)
select
  o.outlet_id,
  'contact.cta_hint',
  'contact',
  to_jsonb($q$Add your mobile number to stay connected — or skip.$q$::text)
from outlets o
on conflict (outlet_id, key) do nothing;
