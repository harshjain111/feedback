-- =============================================================================
-- 0019_contact_hint_no_skip.sql — the hint cannot offer a button that is gone
--
-- 0018 removed SKIP but left contact.cta_hint reading
-- "Add your mobile number to stay connected — or skip."
--
-- Caught by looking at the rendered screen rather than by any test: the string
-- is valid, the key is right, nothing is broken. It just tells a guest to do
-- something the screen no longer lets them do, which is worse than saying
-- nothing — they will hunt for the button before giving up.
--
-- Worth noting for the revert: turning contact.required back off restores SKIP
-- but NOT this wording, because config is data and a migration is not a
-- rollback. Both strings are recorded here so either direction is a copy edit
-- in Settings rather than a code change.
--
--   required:  Please add your mobile number so we can reach you.
--   optional:  Add your mobile number to stay connected — or skip.
-- =============================================================================

update app_config
   set value = to_jsonb($q$Please add your mobile number so we can reach you.$q$::text),
       updated_at = now()
 where key = 'contact.cta_hint';
