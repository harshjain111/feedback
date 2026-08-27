-- =============================================================================
-- 0018_contact_required.sql — contact details become compulsory
--
-- Client decision, and a deliberate departure from the brief: §4 said "both
-- optional, SKIP always visible ... never blocking, never required", §5 seeded
-- a SKIP button, and §11 said "Phone collection is optional. Always." CLAUDE.md
-- is updated in the same commit so the spec and the build do not disagree.
--
-- It is a CONFIG KEY rather than deleted code on purpose. This is the kind of
-- decision that gets reversed after a fortnight of watching the response rate,
-- and reversing it should be a toggle in Settings rather than a deploy. The
-- SKIP copy stays seeded for the same reason — deleting it would mean a
-- migration to come back.
--
-- Two consequences are handled in the same commit rather than left to be
-- discovered:
--
--   * A guest who will not give a number now has no way forward, so they walk
--     away — and their ratings would be lost, because the submit fires on
--     leaving this screen. The idle reset now commits whatever the draft holds
--     before wiping it. The café keeps the feedback the guest freely gave; the
--     contact details they declined are simply absent.
--   * The consent line still has to be true. A number that must be given to
--     proceed is not freely given, so the copy no longer describes it as
--     optional.
-- =============================================================================

insert into app_config (outlet_id, key, section, value)
select o.outlet_id, 'contact.required', 'contact', to_jsonb(true)
from outlets o
on conflict (outlet_id, key) do nothing;

-- The micro line under the buttons said "Optional — you can skip this step",
-- which is now false. §5 fixes the words; it cannot fix them to something the
-- screen no longer does.
update app_config
   set value = to_jsonb($q$We'll use this only to reach you about your visit.$q$::text),
       updated_at = now()
 where key = 'contact.micro';
