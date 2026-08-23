-- =============================================================================
-- 0002_seed.sql — All India Café CXIS
--
-- Every customer-facing string here is the LOCKED COPY of CLAUDE.md §5, copied
-- verbatim. It is seeded as a DEFAULT, not a constant: the CMS (Prompt 35) is
-- the only thing allowed to change it afterwards.
--
-- tests/db/0002-seed.test.ts re-reads CLAUDE.md §5 and asserts every locked
-- string below still matches it character for character.
-- =============================================================================

do $seed$
declare
  v_outlet uuid;
  v_theme  uuid;
begin

-- ---------------------------------------------------------------------------
-- Outlet and kiosk
-- ---------------------------------------------------------------------------
insert into outlets (name, code, city)
values ($q$All India Café$q$, 'AIC', 'Mumbai')
returning outlet_id into v_outlet;

insert into kiosks (outlet_id, label) values (v_outlet, 'Entrance Kiosk');

-- ---------------------------------------------------------------------------
-- Categories (§5)
-- ---------------------------------------------------------------------------
insert into categories (outlet_id, name, question, icon, display_order) values
  (v_outlet, $q$FOOD$q$, $q$How did your food make you feel?$q$, $q$utensils$q$, 1),
  (v_outlet, $q$SERVICE$q$, $q$How was the service you received?$q$, $q$concierge-bell$q$, 2),
  (v_outlet, $q$HOSPITALITY$q$, $q$How did our team make you feel?$q$, $q$heart-handshake$q$, 3),
  (v_outlet, $q$AMBIENCE$q$, $q$How did you find the ambience & cleanliness?$q$, $q$sparkles$q$, 4);

-- ---------------------------------------------------------------------------
-- Rating scale (§5) — face_key, not a glyph. Colours are the approved ramp.
-- ---------------------------------------------------------------------------
insert into rating_scale (outlet_id, value, face_key, label, colour) values
  (v_outlet, 1, $q$angry$q$, $q$Very Poor$q$, $q$#E63329$q$),
  (v_outlet, 2, $q$sad$q$, $q$Poor$q$, $q$#F07829$q$),
  (v_outlet, 3, $q$neutral$q$, $q$Okay$q$, $q$#F5C518$q$),
  (v_outlet, 4, $q$happy$q$, $q$Good$q$, $q$#8DC63F$q$),
  (v_outlet, 5, $q$delighted$q$, $q$Excellent$q$, $q$#39B54A$q$);

-- ---------------------------------------------------------------------------
-- Issue chips (§5)
-- ---------------------------------------------------------------------------
insert into issues (outlet_id, name, kind, display_order) values
  (v_outlet, $q$Food$q$, 'negative', 1),
  (v_outlet, $q$Service$q$, 'negative', 2),
  (v_outlet, $q$Staff$q$, 'negative', 3),
  (v_outlet, $q$Waiting Time$q$, 'negative', 4),
  (v_outlet, $q$Cleanliness$q$, 'negative', 5),
  (v_outlet, $q$Billing$q$, 'negative', 6),
  (v_outlet, $q$Ambience$q$, 'negative', 7),
  (v_outlet, $q$Food$q$, 'positive', 1),
  (v_outlet, $q$Service$q$, 'positive', 2),
  (v_outlet, $q$Our Team$q$, 'positive', 3),
  (v_outlet, $q$Ambience$q$, 'positive', 4),
  (v_outlet, $q$The Experience$q$, 'positive', 5);

-- ---------------------------------------------------------------------------
-- Comment-intelligence lexicon (§9). AUTHORED, not from §5 — editable in
-- settings (Prompt 36); edits can be backfilled over history (Prompt 27).
-- ---------------------------------------------------------------------------
insert into themes (outlet_id, name, kind, display_order) values (v_outlet, $q$Waiting$q$, 'negative', 1) returning theme_id into v_theme;
insert into theme_keywords (theme_id, keyword) values (v_theme, $q$waiting$q$), (v_theme, $q$wait$q$), (v_theme, $q$waited$q$), (v_theme, $q$slow$q$), (v_theme, $q$late$q$), (v_theme, $q$delay$q$), (v_theme, $q$delayed$q$), (v_theme, $q$queue$q$), (v_theme, $q$long time$q$);
insert into themes (outlet_id, name, kind, display_order) values (v_outlet, $q$Cold Food$q$, 'negative', 2) returning theme_id into v_theme;
insert into theme_keywords (theme_id, keyword) values (v_theme, $q$cold$q$), (v_theme, $q$lukewarm$q$), (v_theme, $q$not hot$q$), (v_theme, $q$tepid$q$);
insert into themes (outlet_id, name, kind, display_order) values (v_outlet, $q$Billing$q$, 'negative', 3) returning theme_id into v_theme;
insert into theme_keywords (theme_id, keyword) values (v_theme, $q$bill$q$), (v_theme, $q$billing$q$), (v_theme, $q$charge$q$), (v_theme, $q$charged$q$), (v_theme, $q$overcharge$q$), (v_theme, $q$overcharged$q$), (v_theme, $q$invoice$q$), (v_theme, $q$extra charge$q$);
insert into themes (outlet_id, name, kind, display_order) values (v_outlet, $q$Taste$q$, 'negative', 4) returning theme_id into v_theme;
insert into theme_keywords (theme_id, keyword) values (v_theme, $q$taste$q$), (v_theme, $q$tasteless$q$), (v_theme, $q$bland$q$), (v_theme, $q$salty$q$), (v_theme, $q$spicy$q$), (v_theme, $q$oily$q$), (v_theme, $q$undercooked$q$), (v_theme, $q$burnt$q$);
insert into themes (outlet_id, name, kind, display_order) values (v_outlet, $q$Staff$q$, 'negative', 5) returning theme_id into v_theme;
insert into theme_keywords (theme_id, keyword) values (v_theme, $q$rude$q$), (v_theme, $q$ignored$q$), (v_theme, $q$attitude$q$), (v_theme, $q$unfriendly$q$), (v_theme, $q$impolite$q$), (v_theme, $q$no one came$q$);
insert into themes (outlet_id, name, kind, display_order) values (v_outlet, $q$Cleanliness$q$, 'negative', 6) returning theme_id into v_theme;
insert into theme_keywords (theme_id, keyword) values (v_theme, $q$dirty$q$), (v_theme, $q$unclean$q$), (v_theme, $q$messy$q$), (v_theme, $q$smell$q$), (v_theme, $q$smelly$q$), (v_theme, $q$hygiene$q$), (v_theme, $q$washroom$q$), (v_theme, $q$toilet$q$);
insert into themes (outlet_id, name, kind, display_order) values (v_outlet, $q$Portion$q$, 'negative', 7) returning theme_id into v_theme;
insert into theme_keywords (theme_id, keyword) values (v_theme, $q$portion$q$), (v_theme, $q$small portion$q$), (v_theme, $q$quantity$q$), (v_theme, $q$less quantity$q$);
insert into themes (outlet_id, name, kind, display_order) values (v_outlet, $q$Value$q$, 'negative', 8) returning theme_id into v_theme;
insert into theme_keywords (theme_id, keyword) values (v_theme, $q$expensive$q$), (v_theme, $q$overpriced$q$), (v_theme, $q$costly$q$), (v_theme, $q$not worth$q$);
insert into themes (outlet_id, name, kind, display_order) values (v_outlet, $q$Noise$q$, 'negative', 9) returning theme_id into v_theme;
insert into theme_keywords (theme_id, keyword) values (v_theme, $q$noisy$q$), (v_theme, $q$loud$q$), (v_theme, $q$crowded$q$);
insert into themes (outlet_id, name, kind, display_order) values (v_outlet, $q$Delicious$q$, 'positive', 1) returning theme_id into v_theme;
insert into theme_keywords (theme_id, keyword) values (v_theme, $q$delicious$q$), (v_theme, $q$tasty$q$), (v_theme, $q$yummy$q$), (v_theme, $q$amazing food$q$), (v_theme, $q$great food$q$), (v_theme, $q$flavourful$q$), (v_theme, $q$flavorful$q$);
insert into themes (outlet_id, name, kind, display_order) values (v_outlet, $q$Warm Service$q$, 'positive', 2) returning theme_id into v_theme;
insert into theme_keywords (theme_id, keyword) values (v_theme, $q$friendly$q$), (v_theme, $q$polite$q$), (v_theme, $q$courteous$q$), (v_theme, $q$attentive$q$), (v_theme, $q$helpful$q$), (v_theme, $q$welcoming$q$);
insert into themes (outlet_id, name, kind, display_order) values (v_outlet, $q$Fast Service$q$, 'positive', 3) returning theme_id into v_theme;
insert into theme_keywords (theme_id, keyword) values (v_theme, $q$quick$q$), (v_theme, $q$fast$q$), (v_theme, $q$prompt$q$), (v_theme, $q$on time$q$);
insert into themes (outlet_id, name, kind, display_order) values (v_outlet, $q$Ambience$q$, 'positive', 4) returning theme_id into v_theme;
insert into theme_keywords (theme_id, keyword) values (v_theme, $q$ambience$q$), (v_theme, $q$ambiance$q$), (v_theme, $q$cosy$q$), (v_theme, $q$cozy$q$), (v_theme, $q$beautiful$q$), (v_theme, $q$vibe$q$), (v_theme, $q$music$q$);
insert into themes (outlet_id, name, kind, display_order) values (v_outlet, $q$Value$q$, 'positive', 5) returning theme_id into v_theme;
insert into theme_keywords (theme_id, keyword) values (v_theme, $q$value for money$q$), (v_theme, $q$reasonable$q$), (v_theme, $q$affordable$q$), (v_theme, $q$worth it$q$);
insert into themes (outlet_id, name, kind, display_order) values (v_outlet, $q$Cleanliness$q$, 'positive', 6) returning theme_id into v_theme;
insert into theme_keywords (theme_id, keyword) values (v_theme, $q$clean$q$), (v_theme, $q$spotless$q$), (v_theme, $q$hygienic$q$), (v_theme, $q$well maintained$q$);

-- ---------------------------------------------------------------------------
-- app_config — LOCKED COPY from §5, verbatim
-- ---------------------------------------------------------------------------
insert into app_config (outlet_id, key, section, value) values
  (v_outlet, 'welcome.h1', 'welcome', to_jsonb($q$YOUR EXPERIENCE MATTERS.$q$::text)),
  (v_outlet, 'welcome.h2', 'welcome', to_jsonb($q$Tell us how we did.$q$::text)),
  (v_outlet, 'welcome.support', 'welcome', to_jsonb($q$Your feedback helps us make All India Café better.$q$::text)),
  (v_outlet, 'welcome.cta', 'welcome', to_jsonb($q$SHARE YOUR FEEDBACK →$q$::text)),
  (v_outlet, 'welcome.micro', 'welcome', to_jsonb($q$It takes less than a minute.$q$::text)),
  (v_outlet, 'rate.h1', 'rate', to_jsonb($q$HOW DID WE DO?$q$::text)),
  (v_outlet, 'rate.sub', 'rate', to_jsonb($q$Good, bad or somewhere in between — tell us honestly.$q$::text)),
  (v_outlet, 'rate.cta', 'rate', to_jsonb($q$CONTINUE →$q$::text)),
  (v_outlet, 'negative.h1', 'negative', to_jsonb($q$THANK YOU FOR TELLING US.$q$::text)),
  (v_outlet, 'negative.sub', 'negative', to_jsonb($q$We'd rather know when something wasn't right.$q$::text)),
  (v_outlet, 'negative.h2', 'negative', to_jsonb($q$WHAT HAPPENED?$q$::text)),
  (v_outlet, 'negative.h3', 'negative', to_jsonb($q$TELL US MORE$q$::text)),
  (v_outlet, 'negative.support', 'negative', to_jsonb($q$You don't have to explain everything. Even a few words help.$q$::text)),
  (v_outlet, 'positive.h1', 'positive', to_jsonb($q$THAT'S WONDERFUL TO HEAR! ❤️$q$::text)),
  (v_outlet, 'positive.sub', 'positive', to_jsonb($q$We're glad you had a great experience at All India Café.$q$::text)),
  (v_outlet, 'positive.h2', 'positive', to_jsonb($q$WHAT DID YOU LOVE MOST?$q$::text)),
  (v_outlet, 'comment.h1', 'comment', to_jsonb($q$IS THERE ANYTHING ELSE YOU'D LIKE US TO KNOW?$q$::text)),
  (v_outlet, 'comment.support', 'comment', to_jsonb($q$A compliment, a suggestion or something we could have done better — we'd love to hear it.$q$::text)),
  (v_outlet, 'comment.placeholder', 'comment', to_jsonb($q$YOUR THOUGHTS...$q$::text)),
  (v_outlet, 'comment.badge', 'comment', to_jsonb($q$Optional$q$::text)),
  (v_outlet, 'followup.h1', 'followup', to_jsonb($q$WOULD YOU LIKE US TO FOLLOW UP?$q$::text)),
  (v_outlet, 'followup.support', 'followup', to_jsonb($q$If you'd like, a member of our team can personally reach out to you.$q$::text)),
  (v_outlet, 'followup.yes', 'followup', to_jsonb($q$YES, PLEASE$q$::text)),
  (v_outlet, 'followup.no', 'followup', to_jsonb($q$NO, I'M GOOD$q$::text)),
  (v_outlet, 'contact.h1', 'contact', to_jsonb($q$WE'D LOVE TO STAY CONNECTED ❤️$q$::text)),
  (v_outlet, 'contact.support', 'contact', to_jsonb($q$As a valued customer, we'd love to keep you updated with special offers, new experiences and what's happening at All India Café.$q$::text)),
  (v_outlet, 'contact.name_label', 'contact', to_jsonb($q$Your Name$q$::text)),
  (v_outlet, 'contact.phone_label', 'contact', to_jsonb($q$Mobile Number$q$::text)),
  (v_outlet, 'contact.cta', 'contact', to_jsonb($q$KEEP ME CONNECTED →$q$::text)),
  (v_outlet, 'contact.skip', 'contact', to_jsonb($q$SKIP$q$::text)),
  (v_outlet, 'contact.micro', 'contact', to_jsonb($q$Optional — you can skip this step.$q$::text)),
  (v_outlet, 'thanks.h1', 'thanks', to_jsonb($q$THANK YOU FOR BEING HEARD. ❤️$q$::text)),
  (v_outlet, 'thanks.body', 'thanks', to_jsonb($q$Your feedback helps us make All India Café better for you — and for everyone who walks through our doors.$q$::text)),
  (v_outlet, 'thanks.line', 'thanks', to_jsonb($q$You spoke. We listened.$q$::text)),
  (v_outlet, 'thanks.support', 'thanks', to_jsonb($q$We look forward to serving you better next time.$q$::text)),
  (v_outlet, 'grievance.h1', 'grievance', to_jsonb($q$NEED TO SPEAK TO SOMEONE?$q$::text)),
  (v_outlet, 'grievance.support', 'grievance', to_jsonb($q$Our Grievance Officer is here to listen.$q$::text)),
  (v_outlet, 'footer.brand', 'footer', to_jsonb($q$All India Café$q$::text)),
  (v_outlet, 'footer.website_label', 'footer', to_jsonb($q$Website$q$::text)),
  (v_outlet, 'footer.instagram_label', 'footer', to_jsonb($q$Instagram$q$::text)),
  (v_outlet, 'footer.grievance_label', 'footer', to_jsonb($q$Grievance Officer$q$::text));

-- ---------------------------------------------------------------------------
-- app_config — AUTHORED strings. Not in §5; see the Prompt 03 report.
-- The grievance and branding values are PLACEHOLDERS for the client to
-- replace in the CMS before go-live.
-- ---------------------------------------------------------------------------
insert into app_config (outlet_id, key, section, value) values
  (v_outlet, 'contact.followup_sub', 'contact', to_jsonb($q$Leave your mobile number and a member of our team will personally reach out.$q$::text)),
  (v_outlet, 'contact.phone_hint', 'contact', to_jsonb($q$10 digits, starting 6-9$q$::text)),
  (v_outlet, 'privacy.consent_text', 'privacy', to_jsonb($q$We will only use your number to reach you about your feedback and to share news and offers from All India Café. Ask us any time and we will remove it.$q$::text)),
  (v_outlet, 'grievance.name', 'grievance', to_jsonb($q$Grievance Officer$q$::text)),
  (v_outlet, 'grievance.phone', 'grievance', to_jsonb($q$+91 00000 00000$q$::text)),
  (v_outlet, 'grievance.email', 'grievance', to_jsonb($q$grievance@allindiacafe.in$q$::text)),
  (v_outlet, 'branding.name', 'branding', to_jsonb($q$All India Café$q$::text)),
  (v_outlet, 'branding.logo_url', 'branding', to_jsonb($q$$q$::text)),
  (v_outlet, 'branding.website_url', 'branding', to_jsonb($q$https://allindiacafe.in$q$::text)),
  (v_outlet, 'branding.instagram_url', 'branding', to_jsonb($q$https://instagram.com/allindiacafe$q$::text)),
  (v_outlet, 'branding.instagram_handle', 'branding', to_jsonb($q$@allindiacafe$q$::text));

-- ---------------------------------------------------------------------------
-- app_config — behaviour, thresholds, alerts, rewards, privacy
-- ---------------------------------------------------------------------------
insert into app_config (outlet_id, key, section, value) values
  (v_outlet, 'kiosk.idle_seconds', 'kiosk', '90'::jsonb),
  (v_outlet, 'kiosk.thanks_seconds', 'kiosk', '8'::jsonb),
  (v_outlet, 'thresholds.category_attention', 'thresholds', '3.5'::jsonb),
  (v_outlet, 'thresholds.category_strong', 'thresholds', '4.5'::jsonb),
  (v_outlet, 'thresholds.category_drop_pct', 'thresholds', '10'::jsonb),
  (v_outlet, 'thresholds.issue_spike_pct', 'thresholds', '25'::jsonb),
  (v_outlet, 'thresholds.theme_emerging_pct', 'thresholds', '30'::jsonb),
  (v_outlet, 'thresholds.low_rating_cluster_count', 'thresholds', '3'::jsonb),
  (v_outlet, 'thresholds.min_sample_size', 'thresholds', '5'::jsonb),
  (v_outlet, 'alerts.rating_at_or_below', 'alerts', '2'::jsonb),
  (v_outlet, 'alerts.on_follow_up_requested', 'alerts', 'true'::jsonb),
  (v_outlet, 'alerts.cluster_count', 'alerts', '3'::jsonb),
  (v_outlet, 'alerts.cluster_window_minutes', 'alerts', '45'::jsonb),
  (v_outlet, 'alerts.complaint_spike_pct', 'alerts', '50'::jsonb),
  (v_outlet, 'alerts.cooldown_minutes', 'alerts', '60'::jsonb),
  (v_outlet, 'rewards.enabled', 'rewards', 'false'::jsonb),
  (v_outlet, 'rewards.amount', 'rewards', '0'::jsonb),
  (v_outlet, 'rewards.wallet_provider', 'rewards', 'null'::jsonb),
  (v_outlet, 'privacy.retention_days', 'privacy', 'null'::jsonb),
  (v_outlet, 'privacy.mask_visible_digits', 'privacy', '4'::jsonb);

end
$seed$;
