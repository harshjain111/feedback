-- =============================================================================
-- 0017_brand_logo.sql — the real mark, at the top of every kiosk screen
--
-- BrandMark has always drawn a placeholder cup and always deferred to
-- branding.logo_url the moment one was set. This sets it. No code change was
-- needed, which is the whole point of §3 — the mark is content, not markup.
--
-- The asset is the client's vertical-setup PDF rasterised at 6x and trimmed:
-- a landscape plaque, white type knocked out of #F05429, with genuinely
-- transparent corner cut-outs so the kiosk's ivory ground shows through them
-- rather than a white box sitting on it.
--
-- Lossless WebP rather than lossy: it is flat colour with hard edges, and lossy
-- compression puts visible mush around white type on orange.
--
-- Note the spelling. The mark reads "ALL INNDIA CAFE" — two Ns — which is the
-- brand's own, matching the source file. It is not a typo to be helpfully
-- corrected, here or in branding.name.
-- =============================================================================

update app_config
   set value = to_jsonb($q$/brand/logo.webp$q$::text),
       updated_at = now()
 where key = 'branding.logo_url';
