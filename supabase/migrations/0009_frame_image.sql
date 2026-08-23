-- =============================================================================
-- 0009_frame_image.sql
--
-- The artwork is one full-screen frame, not six per-screen bands. 0007 guessed
-- the wrong shape: the illustration the client supplied is a border with a
-- clear centre, so cropping it into strips would discard the half that makes
-- the screen recognisable.
--
-- One key, defaulting to the bundled file so the kiosk looks right out of the
-- box, and overridable in Settings when the artwork is refreshed.
-- =============================================================================

insert into app_config (outlet_id, key, section, value)
select outlet_id, 'branding.frame_image_url', 'branding',
       to_jsonb('/artwork/frame-portrait.webp'::text)
from outlets
on conflict (outlet_id, key) do nothing;

-- The per-screen slots from 0007 are superseded. Removed rather than left
-- lying around: an empty setting in the CMS that does nothing is worse than no
-- setting at all.
delete from app_config
where key in (
  'branding.welcome_image_url',
  'branding.positive_image_url',
  'branding.negative_image_url',
  'branding.followup_image_url',
  'branding.contact_image_url',
  'branding.thanks_image_url'
);
