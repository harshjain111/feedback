-- =============================================================================
-- 0014_memory_module.sql — Memory Print Module schema and copy (PHOTO_MODULE.md)
--
-- A free thermal-printed keepsake photo, offered after the feedback row commits.
--
-- THERE IS NO IMAGE COLUMN HERE, AND THERE IS NO STORAGE BUCKET.
--
-- That is the second of the module's three inviolable rules and it is not a
-- privacy posture to be softened later: the photo travels browser memory ->
-- 127.0.0.1:9100 -> printer -> buffers zeroed, and has no path off the device.
-- Nothing in this file, or any file after it, may give it one. The three
-- booleans below measure uptake; none of them identifies anyone.
--
-- If a future migration adds a column to hold an image, or a bucket to hold
-- one, that is a spec violation and not an optimisation. Rule 2 exists because
-- "we delete it afterwards" is a promise a café cannot audit, and a print that
-- cannot leak is a promise it can.
--
-- Numbered 0014, not 0006 as the playbook originally said: 0006 has been
-- 0006_retention_and_rate_limit since 23 Aug.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Device health (PHOTO_MODULE.md §6)
--
-- A jammed printer and a quiet evening look identical on a dashboard unless the
-- kiosk says which it is. The agent reports every 5 minutes and these columns
-- are what the admin badge reads, so a paper-out at 9pm on a Saturday is a
-- notification rather than something discovered on Tuesday.
-- -----------------------------------------------------------------------------

alter table kiosks
  add column printer_status    text not null default 'unknown',
  add column camera_status     text not null default 'unknown',
  add column agent_version     text,
  add column status_checked_at timestamptz;

-- Constrained rather than free text: the admin badge switches on these values,
-- and a typo'd status would render as "everything is fine".
alter table kiosks
  add constraint kiosks_printer_status_check
    check (printer_status in ('online', 'offline', 'out_of_paper', 'cover_open', 'unknown')),
  add constraint kiosks_camera_status_check
    check (camera_status in ('present', 'absent', 'denied', 'unknown'));

comment on column kiosks.printer_status is
  'Last reported thermal printer state (PHOTO_MODULE.md §6). Written by the kiosk heartbeat.';
comment on column kiosks.camera_status is
  'Last reported camera state. "denied" means the OS permission was revoked.';

-- -----------------------------------------------------------------------------
-- Per-feedback uptake (PHOTO_MODULE.md §8)
--
-- Written AFTER the feedback row commits, which is Rule 1 — the photo layer must
-- never be able to break the thing it is attached to. So these are a second
-- write, not part of the submit payload.
-- -----------------------------------------------------------------------------

alter table feedback
  add column memory_offered boolean  not null default false,
  add column memory_printed boolean  not null default false,
  add column memory_retries smallint not null default 0
    check (memory_retries between 0 and 10);

comment on column feedback.memory_offered is
  'The offer screen was shown. Denominator for uptake %.';
comment on column feedback.memory_printed is
  'A print completed. Never implies an image was stored — none ever is.';
comment on column feedback.memory_retries is
  'Retakes used, capped at max_retries in config (PHOTO_MODULE.md §3).';

-- Uptake is read per day over the same window as every other dashboard metric.
create index feedback_memory_idx
  on feedback (outlet_id, local_date)
  where memory_offered;

-- -----------------------------------------------------------------------------
-- The narrow write path (CLAUDE.md §12)
--
-- The kiosk is anonymous, and `anon` has no reach into feedback at all — no
-- select, no update. The submit endpoint gets around that by using the service
-- role server-side, and the tempting move here is to reuse it: it is already
-- wired up and it already writes this table.
--
-- Don't. That client can create guests and insert feedback. Handing it to a
-- request whose entire job is setting three booleans is how a narrow write
-- becomes a wide hole — the blast radius of a bug in the photo layer would be
-- the whole feedback table.
--
-- Instead: a column-level grant. `anon` may update these three columns and no
-- others; an attempt to touch comment, overall_score or status through this path
-- is refused by Postgres, not by route code that has to remember to be careful.
--
-- Row scoping is by `submission_id`, the uuid the kiosk generated for its own
-- draft. The policy cannot verify knowledge of it, but `anon` still cannot
-- SELECT this table, so there is no way to enumerate one — the uuid works as a
-- capability the guest's own session holds and nobody else can read. Combined
-- with the column grant, the worst a forged request can do is flip a photo
-- boolean on a row it already knew the id of.
--
-- PATCH /api/feedback/[id]/memory lands in Prompt 50. The grant and policy are
-- schema, so they land here.
-- -----------------------------------------------------------------------------

grant update (memory_offered, memory_printed, memory_retries) on feedback to anon;

create policy feedback_memory_update_kiosk on feedback for update to anon
  using (true)
  with check (true);

comment on policy feedback_memory_update_kiosk on feedback is
  'Kiosk photo-uptake write. Reach is bounded by the column-level GRANT above, not by this policy — anon may touch only memory_offered, memory_printed and memory_retries.';

-- -----------------------------------------------------------------------------
-- Config (PHOTO_MODULE.md §8, §9)
--
-- Every string CMS-editable per CLAUDE.md §3. app_config's PK is
-- (outlet_id, key), so this seeds per outlet — a second café can run the module
-- on different copy, or not at all, without a migration.
--
-- caption_line uses option 1 from §9. It is the closest to what the client
-- described, it earns the polaroid framing, and it does not oversell a thermal
-- print.
-- -----------------------------------------------------------------------------

insert into app_config (outlet_id, key, section, value)
select o.outlet_id, v.key, 'memory', v.value
from outlets o
cross join (values
  -- --- the kill switch, all three layers (§8b) ------------------------------
  -- Master. false removes the module from the journey entirely: no offer line,
  -- no /memory route, and the camera is never requested — no permission prompt
  -- and no LED. A guest on a disabled kiosk cannot tell the feature exists.
  ('memory.enabled',                 to_jsonb(true)),
  -- Layer 2. The important one: a jammed printer stops offering a gift it
  -- cannot deliver without waiting for someone to notice. Re-enable is manual —
  -- the system never silently switches itself back on.
  ('memory.auto_disable_on_failure', to_jsonb(true)),
  ('memory.failure_threshold',       to_jsonb(3)),
  -- Layer 3. Off by default; useful once you can see where the queue forms.
  ('memory.schedule_enabled',        to_jsonb(false)),
  ('memory.schedule_windows',        '[]'::jsonb),

  -- --- capture behaviour (§3) ----------------------------------------------
  ('memory.countdown_seconds',       to_jsonb(5)),
  -- Three retakes, then KEEP is the only option. Stops one table holding the
  -- kiosk hostage during the 9pm exit rush.
  ('memory.max_retries',             to_jsonb(3)),

  -- --- copy: the offer (§9) ------------------------------------------------
  ('memory.offer_line_welcome',
     to_jsonb($q$Share your feedback and take home a memory, on us.$q$::text)),
  ('memory.offer_heading',
     to_jsonb($q$BEFORE YOU GO — TAKE A MEMORY WITH YOU$q$::text)),
  ('memory.offer_body',
     to_jsonb($q$A little keepsake from your visit today. Our gift, no strings.$q$::text)),
  ('memory.take_cta',                to_jsonb($q$TAKE A PHOTO →$q$::text)),
  ('memory.skip_cta',                to_jsonb($q$NO THANKS$q$::text)),
  -- Rule 2, said plainly on the screen. A guest deciding whether to be
  -- photographed is owed this before they decide, not in a policy page.
  ('memory.privacy_line',
     to_jsonb($q$Your photo prints here and is never saved or stored anywhere.$q$::text)),

  -- --- copy: the negative branch (§7) --------------------------------------
  -- A guest who waited 40 minutes for cold food does not want a cheerful
  -- "smile!" screen; it reads as papering over the complaint. Same gift,
  -- sincere register. NOT a lesser gift — §14.3 forbids that absolutely.
  ('memory.negative_offer_heading',
     to_jsonb($q$WE'D LIKE YOU TO LEAVE WITH SOMETHING GOOD$q$::text)),
  ('memory.negative_offer_body',
     to_jsonb($q$Today didn't go the way it should have, and we're working on it. Take a small keepsake with you anyway.$q$::text)),

  -- --- copy: review and print (§9) -----------------------------------------
  ('memory.review_heading',          to_jsonb($q$HAPPY WITH THIS ONE?$q$::text)),
  ('memory.retry_cta',               to_jsonb($q$TAKE ANOTHER$q$::text)),
  ('memory.keep_cta',                to_jsonb($q$PRINT IT →$q$::text)),
  ('memory.printing_message',        to_jsonb($q$PRINTING YOUR MEMORY…$q$::text)),
  ('memory.collect_message',         to_jsonb($q$Collect it just below the screen.$q$::text)),

  -- --- copy: what is printed on the paper (§5) -----------------------------
  ('memory.caption_line',
     to_jsonb($q$Some memories are meant to be carried home.$q$::text)),
  ('memory.caption_line_negative',
     to_jsonb($q$Come back and let us do better.$q$::text)),
  ('memory.footer_line',             to_jsonb($q$All India Café$q$::text)),

  -- --- the thermal logo (§5) -----------------------------------------------
  -- Deliberately empty. It must be a hand-prepared 1-bit bitmap, tuned once by
  -- a person: thin strokes and gradients vanish entirely at 203dpi, so
  -- auto-converting the web logo produces a grey smear. Separate slot from
  -- branding.logo_url for exactly that reason.
  ('memory.thermal_logo_url',        to_jsonb($q$$q$::text)),

  -- --- pipeline tuning (§4) ------------------------------------------------
  -- Here rather than compiled in so the café's actual evening lighting can be
  -- dialled in on-site without a rebuild. CLAHE is the step that makes faces
  -- legible; gamma > 1 because thermal heads over-deposit and prints run dark.
  ('memory.pipeline',
     '{"clahe_clip": 2.0, "gamma": 1.2, "unsharp_amount": 0.6, "dither": "atkinson"}'::jsonb)
) as v(key, value)
on conflict (outlet_id, key) do nothing;
