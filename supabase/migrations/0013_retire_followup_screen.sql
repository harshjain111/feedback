-- =============================================================================
-- 0013_retire_followup_screen.sql — delete the copy for a screen that is gone
--
-- The brief's §11 screen — WOULD YOU LIKE US TO FOLLOW UP? / YES, PLEASE /
-- NO, I'M GOOD — is cut (CLAUDE.md §4). It asked consent to make contact and was
-- immediately followed by a screen asking for a phone number: the same question
-- twice, and only the second one produces anything actionable.
--
-- Deleting the rows rather than leaving them seeded, because they were not
-- harmless. Settings > Content still listed a "Follow-up" tab whose fields a
-- manager could edit — beside a live kiosk preview of a screen no guest can
-- reach. Config with nothing behind it is worse than missing config: it looks
-- like it works.
--
-- follow_up_requested is now derived at submit time
-- (sentiment = 'negative' and a phone was left), so nothing reads these.
-- `contact.followup_sub` is a DIFFERENT key, is still live, and is not touched
-- here — it is the variant subheading on the contact screen.
-- =============================================================================

delete from app_config
where section = 'followup'
   or key like 'followup.%';
