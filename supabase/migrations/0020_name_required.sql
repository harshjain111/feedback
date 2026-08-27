-- =============================================================================
-- 0020_name_required.sql — the name becomes compulsory too
--
-- 0018 required the phone. This extends `contact.required` to cover the name as
-- well, so both fields must be filled before a guest can leave the screen.
--
-- Two copy changes follow from it rather than being cosmetic:
--
--   * cta_hint said "mobile number" alone. A guest who typed a number and still
--     found the button dead would have no idea why.
--   * name_hint is new, mirroring phone_hint: an inline line on the field
--     itself, so the guest is told which field is the problem rather than
--     hunting between two.
--
-- Everything here reverts with contact.required. The strings stay seeded either
-- way — turning the requirement off simply stops rendering them.
-- =============================================================================

update app_config
   set value = to_jsonb($q$Please add your name and mobile number so we can reach you.$q$::text),
       updated_at = now()
 where key = 'contact.cta_hint';

insert into app_config (outlet_id, key, section, value)
select o.outlet_id, 'contact.name_hint', 'contact',
       to_jsonb($q$Please tell us your name.$q$::text)
from outlets o
on conflict (outlet_id, key) do nothing;
