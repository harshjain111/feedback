-- =============================================================================
-- 0007_artwork_and_icons.sql
--
-- Two additions the visual rebuild needs, both data rather than code so the
-- café can change them without a deploy (§3).
--
--  1. A per-screen artwork slot. The approved design has an illustration along
--     the bottom of most screens; these hold the URL of each. Empty means the
--     screen falls back to a drawn wash, so an unset slot looks deliberate
--     rather than broken.
--
--  2. Icons on the issue chips. The chips render as icon tiles now, and a tile
--     with no icon is just a worse text chip.
-- =============================================================================

insert into app_config (outlet_id, key, section, value)
select o.outlet_id, k.key, 'branding', '""'::jsonb
from outlets o
cross join (values
  ('branding.welcome_image_url'),
  ('branding.positive_image_url'),
  ('branding.negative_image_url'),
  ('branding.followup_image_url'),
  ('branding.contact_image_url'),
  ('branding.thanks_image_url')
) as k(key)
on conflict (outlet_id, key) do nothing;

-- -----------------------------------------------------------------------------
-- Chip icons. Matched to the approved reference; all are names the kiosk's
-- curated lucide map knows, so none of them fall back.
-- -----------------------------------------------------------------------------
update issues set icon = 'utensils'              where icon is null and name = 'Food';
update issues set icon = 'concierge-bell'        where icon is null and name = 'Service';
update issues set icon = 'user-round'            where icon is null and name = 'Staff';
update issues set icon = 'timer'                 where icon is null and name = 'Waiting Time';
update issues set icon = 'spray-can'             where icon is null and name = 'Cleanliness';
update issues set icon = 'receipt-indian-rupee'  where icon is null and name = 'Billing';
update issues set icon = 'armchair'              where icon is null and name = 'Ambience';
update issues set icon = 'users'                 where icon is null and name = 'Our Team';
update issues set icon = 'sparkles'              where icon is null and name = 'The Experience';

-- Anything a future outlet adds without choosing an icon still renders.
update issues set icon = 'smile' where icon is null;
