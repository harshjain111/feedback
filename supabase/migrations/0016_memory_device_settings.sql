-- =============================================================================
-- 0016_memory_device_settings.sql — camera and printer, configurable from admin
--
-- Until now the camera was hard-coded and everything about the printer lived in
-- agent/config.json on the kiosk PC. That is fine for a value set once at
-- install and wrong for anything a manager might want to change: tuning print
-- darkness meant someone with a keyboard standing at the machine.
--
-- These move to app_config so Settings > Memory can hold them. The kiosk reads
-- them like any other config and passes the printer half to the agent with each
-- print request; the agent still falls back to its own config.json, so it keeps
-- working standalone and an unreachable database cannot stop a print.
--
-- The share is the one value that stays machine-shaped. It is a Windows path,
-- it is set once when the printer is plugged in, and letting a browser name an
-- arbitrary write target on the kiosk PC is a bigger door than this feature
-- needs. The agent validates anything it is sent against a printer-share shape
-- and refuses the rest.
-- =============================================================================

insert into app_config (outlet_id, key, section, value)
select o.outlet_id, v.key, 'memory', v.value
from outlets o
cross join (values
  -- --- camera (§3) ---------------------------------------------------------
  -- Requested rather than demanded: getUserMedia treats these as ideals, so a
  -- camera that cannot do 1920x1080 gives its closest match instead of failing.
  ('memory.camera_width',   to_jsonb(1920)),
  ('memory.camera_height',  to_jsonb(1080)),
  -- The preview is mirrored because people expect a mirror. This only ever
  -- affects the PREVIEW; the captured frame is never flipped, or text on
  -- clothing prints backwards.
  ('memory.mirror_preview', to_jsonb(true)),
  -- Empty = whatever the OS calls the front camera. A kiosk with two cameras
  -- (a webcam plus a built-in) needs the label to pick the right one.
  ('memory.camera_label',   to_jsonb($q$$q$::text)),

  -- --- printer (§5, §6) ----------------------------------------------------
  ('memory.printer_share',  to_jsonb($q$$q$::text)),
  ('memory.print_copies',   to_jsonb(1))
) as v(key, value)
on conflict (outlet_id, key) do nothing;
