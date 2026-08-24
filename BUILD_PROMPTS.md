# AIC CXIS — Claude Code Build Playbook

**52 sequential prompts. Run them in order, one at a time.**

Prompts 01–44 build the core system. **45–52 build the Memory Print Module** (front-camera keepsake photo on the built-in thermal printer) — run these after 44, against `PHOTO_MODULE.md`.

---

> ## STATUS — 24 Aug 2026
>
> **Prompts 01–44 are DONE.** Core system built, deployed, and live. Migrations `0001`–`0013`
> are applied to the production Supabase project. Do not re-run them.
>
> **Prompt 15 is CANCELLED.** The follow-up screen is cut (CLAUDE.md §4). Its config section
> was deleted in `0013`. Skip it — do not build it, and do not restore it if a later draft of
> the brief still shows it.
>
> **Prompts 45–52 are QUEUED, not started.** The print agent cannot be tested without the
> physical kiosk and printer, and Prompt 46's checkpoint is explicitly "run real photos through
> it and show me the previews". Pick these up when the hardware arrives.
>
> **Migration numbering:** the memory module starts at **`0014`**, not `0006`. `0006` is
> `0006_retention_and_rate_limit`, applied on 23 Aug. Prompt 45 below is corrected.
>
> Beyond 44 the core system has also gained: an admin visual rebuild, the `--kpx` kiosk canvas
> unit (§6 — 1080×1920 is a device resolution, not a CSS one), a rating-distribution view
> (`0011`), and `KEEP ME CONNECTED` gated on a valid phone (`0012`). The repo is the source of
> truth for all of it. **Anything in this playbook that contradicts the repo is out of date.**

## How to use

1. `mkdir aic-cxis && cd aic-cxis && claude`
2. Drop `CLAUDE.md` **and `PHOTO_MODULE.md`** in the repo root before Prompt 01.
3. Paste one prompt. Let it finish. **Review the diff. Commit.** Then paste the next.
4. If a prompt produces something wrong, fix it in that step — never carry a defect forward.
5. Prompts marked 🔍 are checkpoints: stop, run the app, click through it yourself.

---

# PHASE A — FOUNDATION (01–06)

### Prompt 01 — Scaffold
```
Read CLAUDE.md fully before starting.

Scaffold the project: Next.js 15 App Router + TypeScript strict + Tailwind v4 + shadcn/ui,
pnpm, ESLint + Prettier. Create the exact folder structure in CLAUDE.md §2 with placeholder
files. Set up .env.example with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY. Add lib/supabase/{client,server,admin}.ts wrappers — admin.ts must
throw if imported into a client bundle.

Add lib/time.ts with Asia/Kolkata helpers: nowIST(), toLocalDate(), toLocalTime(),
dayOfWeek(), hourBucket(). All business logic uses these, never raw Date.

Do not build any UI yet. Confirm pnpm dev boots clean.
```

### Prompt 02 — Core schema
```
Write migration 0001_core_schema.sql implementing every table in CLAUDE.md §7:
outlets, kiosks, guests, feedback, feedback_ratings, feedback_issues, categories, issues,
rating_scale, follow_ups, app_config, app_users, alerts, audit_log.

Include all constraints, indexes and FKs. Critical indexes: feedback(outlet_id, local_date),
feedback(outlet_id, status), feedback(guest_id), guests(outlet_id, phone) UNIQUE,
feedback_ratings(category_id), feedback_issues(issue_id).

Add a Postgres trigger on feedback insert that maintains guests.total_feedbacks,
guests.average_rating, first_feedback_date and last_feedback_date. Aggregates are never
computed in app code.

Add sequence-backed code generators: guest_code as AIC-000001 and feedback_code as
AIC-YYYYMMDD-00001 (daily-resetting counter).
```

### Prompt 03 — Seed data
```
Write migration 0002_seed.sql. Seed:
- One outlet "All India Café" (code AIC), one kiosk "Entrance Kiosk"
- The 4 categories from CLAUDE.md §5 with exact names, questions, icons, order
- The 5-row rating_scale with face_key, labels and the exact hex colours from §5
- The 7 negative issue chips and the 5 positive chips (kind = 'negative' / 'positive')
- Every app_config row containing the LOCKED COPY in §5, verbatim, character for character.
  Namespace by section: welcome, rate, negative, positive, comment, followup, contact,
  thanks, grievance, footer, branding, thresholds, alerts, rewards, privacy.
- rewards.enabled = false

Cross-check every string against §5 before finishing. Report any you had to guess.
```

### Prompt 04 — RLS
```
Write migration 0003_rls.sql. Enable RLS on all tables. Implement CLAUDE.md §8 role matrix.
Anon role gets ZERO read access to feedback, guests, app_users, audit_log. Admin reads are
scoped to the outlet_id on the caller's app_users row. STAFF sees only follow_ups where
assigned_to = auth.uid(), and cannot select guests.phone.

Write a short SQL test script proving each role can and cannot do what the matrix says.
```

### Prompt 05 — Config layer
```
Run supabase gen types typescript into types/database.ts.

Build lib/config.ts: getConfig() — a cached (React cache + 60s revalidate) server function
returning a fully typed AppConfig object assembled from app_config, plus getCategories(),
getRatingScale(), getIssues(kind). All return typed objects, no any.

Add a typed default fallback so a missing config key never crashes the kiosk — it logs and
falls back to the seeded default.
```

### Prompt 06 — Design system 🔍
```
Read /mnt/skills/public/frontend-design/SKILL.md if available, then build the visual
foundation per CLAUDE.md §6.

Define Tailwind theme tokens: an ivory/cream ground, deep ink text, one warm accent
(terracotta or saffron), plus the five rating colours. Warm display serif for kiosk headings,
Inter/Geist for UI. Type scale sized for a 1080x1920 portrait screen viewed standing at
arm's length — H1 >= 56px, body >= 24px, nothing below 20px.

Build a /styleguide route rendering: type scale, colour tokens, BigButton (primary/secondary),
FaceScale in every state, chip in selected/unselected state.

Premium and restrained. No gradients-as-decoration, no drop shadows everywhere, no
generic-SaaS look. This should feel like a considered hospitality brand.

STOP. I will review the styleguide before you continue.
```

---

# PHASE B — KIOSK (07–17)

### Prompt 07 — Kiosk shell
```
Build app/(kiosk)/layout.tsx: portrait-locked container, persistent footer (All India Café ·
Website · Instagram · Grievance Officer — all from config), and an IdleResetProvider that
returns to / and clears the draft after config.kiosk.idle_seconds (default 90).

Add lib/session.ts: a typed FeedbackDraft in sessionStorage with helpers
get/patch/clear/isComplete. Nothing writes to Postgres until the final submit.

Disable text selection, right-click, pull-to-refresh, overscroll. Add overscroll-behavior: none.
```

### Prompt 08 — Screen 01 Welcome
```
Build app/(kiosk)/page.tsx from config.welcome. Exact copy from CLAUDE.md §5.
One obvious CTA. No personal information requested on this screen — this screen is about
agency, not data collection. Zero hard-coded strings.
```

### Prompt 09 — FaceScale component
```
Build components/kiosk/FaceIcon.tsx and components/kiosk/FaceScale.tsx per CLAUDE.md §5.

FaceIcon: hand-authored inline SVG, one path set per face_key (angry, sad, neutral, happy,
delighted). Props: faceKey, colour, size. Solid filled circle, no outline, no gradient, no
shadow. Eyes and mouth are WHITE NEGATIVE SPACE cut out of the circle. Eyebrows on angry and
sad only. Flat and friendly — no 3D shading or gloss. Do NOT use Unicode emoji: the five faces
must render identically on every device.

FaceScale: the five faces in one horizontal row, equal size and spacing, driven by the DB
rating_scale rows. Props: scale, value, onChange.

The face is the PRIMARY interaction — never stars, never a number the guest has to interpret.
Colour must read before the label does.

Selected state: enlarged face, coloured ring, subtle scale animation <= 200ms, unmistakable.
Unselected faces sit at reduced opacity so the selection pops. Tap targets >= 140px.
Fully keyboard and screen-reader accessible (radiogroup semantics, aria-label from the label).
Render all five faces in every state on /styleguide so I can approve the drawing before it
goes into a screen.
```

### Prompt 10 — Screen 02 Rate 🔍
```
Build app/(kiosk)/rate/page.tsx. ALL FOUR categories on ONE screen — no separate page per
rating. Each row: icon, category name, question, FaceScale.

Copy from config.rate: "HOW DID WE DO?" and "Good, bad or somewhere in between — tell us
honestly." That subheading is load-bearing — it gives explicit permission to criticise.

CONTINUE → is disabled until all active categories are rated. Must fit 1080x1920 with no
scrolling. Persist to draft on each tap.

STOP. I want to see this on the actual kiosk screen before you continue.
```

### Prompt 11 — Branch router
```
Add lib/journey.ts implementing CLAUDE.md §4 routing:
- any single rating <= 2 → /issues (negative pathway)
- avg >= 4 and no rating <= 2 → /loved (positive pathway)
- otherwise → /comment
Unit-test the branch logic with edge cases: all 3s, one 2 among four 5s, all 5s, all 1s.
Wire CONTINUE on /rate to it.
```

### Prompt 12 — Negative pathway
```
Build app/(kiosk)/issues/page.tsx from config.negative.

The first thing the guest sees is "THANK YOU FOR TELLING US." followed by "We'd rather know
when something wasn't right." — never defensive, never an apology-wall. Then "WHAT HAPPENED?"

Multi-select issue chips from issues where kind='negative' and active. Then TELL US MORE with
a large optional textarea and the line "You don't have to explain everything. Even a few words
help." Selecting nothing is allowed — CONTINUE is always enabled.
```

### Prompt 13 — Positive pathway
```
Build app/(kiosk)/loved/page.tsx from config.positive: "THAT'S WONDERFUL TO HEAR! ❤️",
"We're glad you had a great experience at All India Café.", "WHAT DID YOU LOVE MOST?"
Multi-select chips where kind='positive'. This captures what creates delight, not just the
score. Everything optional.
```

### Prompt 14 — General comment
```
Build app/(kiosk)/comment/page.tsx from config.comment. Large textarea, placeholder
"YOUR THOUGHTS...", a visible "Optional" badge. Never force typing. Ensure the field scrolls
above the on-screen keyboard on a tablet. Character counter only past 400 chars.
```

### ~~Prompt 15 — Follow-up~~ — CANCELLED
```
DO NOT BUILD THIS. The screen is cut — CLAUDE.md §4.

It asked consent to make contact and was immediately followed by a screen asking for a phone
number: the same question twice, and only the second produces anything actionable. A callback
is now inferred at submit time — sentiment = 'negative' AND a phone was left.

Migration 0013 deleted the followup.* config section, AppConfig has no `followup` member, and
the Settings > Content tab for it is gone. Restoring the screen means restoring all of that,
so do not do it because an older copy of the brief still lists it at §11.

The principle it carried is NOT cancelled and is still tested: no guest-facing copy in any
section may contain "complaint", "lodge" or "manager".
```

### Prompt 16 — Contact
```
Build app/(kiosk)/contact/page.tsx from config.contact. Name + Mobile Number, BOTH optional.
SKIP is always visible and equally reachable — never a tiny grey link.

If draft.followUpRequested is true, show the config'd variant subheading explaining we need a
number to reach them — but the field stays optional and SKIP stays available. Never block.

Validate phone as a 10-digit Indian mobile only if something was typed. Show the consent line
from config.privacy.consent_text plainly, not in fine print.
```

### Prompt 17 — Submit API + thank you 🔍
```
Build POST /api/feedback (service role, server only):
- zod-validate the whole draft
- resolve guest: phone exists → attach; new phone → create with next guest_code;
  no phone → guest_id NULL (still fully counted in analytics)
- insert feedback with feedback_code, submitted_at, and denormalised local_date, local_time,
  day_of_week, hour_bucket in Asia/Kolkata
- insert feedback_ratings and feedback_issues
- compute and store overall_score
- if follow_up_requested, create a follow_ups row with status OPEN
- run alert evaluation (stub for now, real logic in Prompt 31)
- return { feedbackCode }
Idempotent on a client-generated submissionId to survive double-taps.

Then build app/(kiosk)/thanks/page.tsx from config.thanks and config.grievance: exact copy
from §5, the grievance block with a tel: link, then auto-reset to / after config.kiosk
.thanks_seconds (default 8) with a subtle progress indicator.

STOP. Full end-to-end walkthrough — I want to submit a real feedback and see the row in
Supabase.
```

---

# PHASE C — ADMIN FOUNDATION (18–22)

### Prompt 18 — Auth + guard
```
Supabase Auth email/password. Build /admin/login, an auth guard in (admin)/layout.tsx, and a
getCurrentUser() server helper returning the app_users row with role. Redirect unauthenticated
to login. Build lib/permissions.ts with can(user, action) covering the §8 matrix, and use it in
both route guards and UI.
```

### Prompt 19 — Admin shell
```
Build the admin layout: sidebar (Today, Feedback, Guests, Analytics, Reports, Settings,
Users), header with outlet selector (single outlet for now, but built for many), user menu,
and a global DateRangeFilter component: Today | Yesterday | 7 Days | 30 Days | Custom.
The date range lives in the URL as searchParams so views are shareable and bookmarkable.
Admin UI is dense, information-first, desktop-oriented — the opposite of the kiosk.
```

### Prompt 20 — Metrics library
```
Build lib/analytics/metrics.ts as pure, unit-tested functions implementing every formula in
CLAUDE.md §9: averageRating, positivePct, negativePct, neutralPct, complaintRate,
followUpRate, resolutionRate, avgResolutionTime, repeatGuestPct.

Then lib/analytics/comparison.ts: compare(current, previous) returning
{ value, previous, delta, deltaPct, direction }. And resolvePeriods(range) returning the
current window plus its correct comparison window (today→yesterday, week→last week,
custom→preceding equal-length period).

Write real tests including zero-division and empty-period cases.
```

### Prompt 21 — Query layer
```
Build lib/queries/ — typed server-side data access:
getKpis(range), getCategoryPerformance(range), getTrend(range, granularity),
getTopIssues(range), getFeedbackList(filters, pagination), getFeedbackDetail(id),
getGuestList(filters), getGuestProfile(id), getTodaySnapshot().

Every one returns comparison-enriched values, never bare numbers. Push aggregation into
Postgres (SQL views or RPC) rather than pulling rows into Node. Add migration 0004 for the
aggregate views.
```

### Prompt 22 — KPI + Insight cards
```
Build components/admin/KpiCard.tsx and components/admin/InsightCard.tsx.

KpiCard shows the value, the delta with direction arrow and colour, and the comparison label
("vs previous 7 days") — never a bare number. A "Needs attention" flag when below the
configurable threshold.

InsightCard is the reusable component from CLAUDE.md §9: severity colour, title, value, delta,
supporting evidence line ("Main issue: Waiting Time — 23 mentions"), and a VIEW FEEDBACK →
deep link that carries a pre-filtered query into the feedback list. Add both to /styleguide.
```

---

# PHASE D — DASHBOARD (23–31)

### Prompt 23 — Today at a Glance 🔍
```
Build /admin as the Today at a Glance screen per CLAUDE.md §32. Order matters —
Problems → Trends → Insights → Actions → Raw Data:

1. Top KPI row: Overall Experience + the four categories, each with delta (§20)
2. WHAT NEEDS ATTENTION? — auto-generated insight cards (§21). Most important block on the page.
3. TODAY'S BIGGEST ISSUE / TODAY'S BIGGEST WIN paired cards
4. Snapshot strip: Feedbacks, Avg Experience, Positive %, Negative count, Follow-ups required
5. WHAT CUSTOMERS LOVE (§22) — the dashboard must balance problems and strengths

Target: the owner understands the state of the café in about 60 seconds. If a block doesn't
earn its place against that test, cut it.

STOP for review.
```

### Prompt 24 — Insight generation engine
```
Build lib/analytics/insights.ts generating the §9 insight types from data — the system writes
these, not a human: CATEGORY_DROP, ISSUE_SPIKE, LOW_RATING_CLUSTER, CATEGORY_STRONG,
THEME_EMERGING.

Each insight must answer: what happened, how significant, improving or worsening, why,
what to look at next. Each carries a severity and a deep-link filter object.

All thresholds read from config.thresholds — nothing hard-coded. Rank by severity × magnitude
and return the top N. Unit-test each generator against fixtures.
```

### Prompt 25 — Trend analytics
```
Build /admin/analytics: an overall satisfaction daily line chart, then one chart per category
(Food, Service, Hospitality, Ambience), each supporting 7 / 30 / 90 days / custom.
Recharts, consistent colour language with the rating scale. Sparse, readable axes.
Handle sparse data honestly — show gaps, never interpolate a day with no feedback.
```

### Prompt 26 — Category performance + top issues
```
Add to /admin/analytics: the §24 category performance table (Score, Trend arrow, Status dot
against configurable thresholds) and the §25 Top Areas of Improvement ranked table with
mention counts and period-over-period change ("Waiting Time ↑ 28%"). Both rows click through
to a filtered feedback list.
```

### Prompt 27 — Comment intelligence
```
Build lib/analytics/themes.ts: keyword/lexicon theme extraction per CLAUDE.md §9. Seed the
keyword→theme map in migration 0005, editable later from settings.

Render TOP NEGATIVE THEMES and TOP POSITIVE THEMES tables with mention counts. Clicking a
theme opens the feedbacks containing it, with the ORIGINAL COMMENT shown verbatim — the raw
text is always preserved and always primary. Analysis assists management, it never replaces
the guest's own words.
```

### Prompt 28 — Time & day analysis
```
Build the §33 time-of-day view (12–3, 3–6, 6–9, 9–12 buckets) and §34 day-of-week comparison,
both segmentable by category. Surface findings as insight cards when a pattern is significant,
e.g. "Service satisfaction drops between 8 PM and 10 PM" or "Saturday service is consistently
below weekday service". Require a minimum sample size before claiming a pattern.
```

### Prompt 29 — Feedback list
```
Build /admin/feedback: paginated table (code, date/time, guest, overall, per-category ratings
as coloured dots, issue tags, comment excerpt, follow-up flag, status). Filters: date range,
rating band, category, issue, follow-up requested, status, has-comment, guest type.
All filters in URL searchParams so insight-card deep links land pre-filtered. Phone masked.
```

### Prompt 30 — Feedback detail + follow-up workflow
```
Build /admin/feedback/[id] per CLAUDE.md §28: header with feedback code, guest, masked phone,
date and time; the four ratings; improvement areas; the verbatim comment; follow-up status.

Workflow: OPEN → CONTACTED → RESOLVED → CLOSED. Assign to a user, timestamped internal notes
thread, resolution text field. Every transition writes to audit_log with actor and timestamp.
Enforce permissions — STAFF can only act on follow-ups assigned to them.
```

### Prompt 31 — Real-time alerts
```
Implement §27 alerts properly. Evaluate on write in POST /api/feedback and expose
GET /api/alerts. Triggers, all configurable: rating <= threshold; follow-up requested;
N negative ratings within M minutes; a category dropping suddenly; complaint volume spiking.

Dashboard polls every 60s and shows an alert banner with VIEW FEEDBACK →. Alerts are
acknowledgeable and deduplicated so the same condition doesn't fire repeatedly within a
cooldown window.
```

---

# PHASE E — GUESTS (32–34)

### Prompt 32 — Guest database
```
Build /admin/guests per §29: table of guest, feedback count, avg rating, last feedback, status
dot. Search by name or phone. Filters: New Guests, Repeat Guests, Negative Guests, Follow-up
Required, High Engagement — each with a clear configurable definition documented in code.
Phone masked in this view for all roles.
```

### Prompt 33 — Guest profile
```
Build /admin/guests/[id] per §30: name, phone (unmasked for MANAGER+, unmask action
audit-logged), summary metrics (total feedbacks, average experience, per-category averages),
and full feedback history table with per-visit ratings, overall and comment.
```

### Prompt 34 — Experience journey
```
Add the §31 Experience Journey to the guest profile: a chronological progression of that
guest's overall scores (3.2 → 3.8 → 4.4 → 4.7) as a compact sparkline plus a computed verdict
badge — CUSTOMER EXPERIENCE IMPROVING or CUSTOMER EXPERIENCE DECLINING — using a defensible
trend rule (linear slope over their last N visits, minimum 3 visits, with a stable band).
Surface declining repeat guests as a dashboard insight — this is a high-value management signal.
```

---

# PHASE F — CMS, REPORTS, EXPORT (35–41)

### Prompt 35 — Settings: kiosk content 🔍
```
Build /admin/settings/content — a CMS editing every customer-facing string in app_config,
grouped by screen (Welcome, Rate, Negative, Positive, Comment, Follow-up, Contact, Thank-you).

Each screen section shows a LIVE PORTRAIT PREVIEW of the kiosk beside the fields so the manager
sees exactly what the guest will see. Save writes to app_config + audit_log and revalidates the
config cache. Add "Reset to default" per field.

STOP — change a string here and confirm it changes on the kiosk without a redeploy.
```

### Prompt 36 — Settings: categories & issues
```
Build /admin/settings/categories and /admin/settings/issues: full CRUD plus drag-to-reorder
(display_order) and active/inactive toggle. Editable: name, question, icon, order, active.
Deactivating never deletes historical data — past feedback for a deactivated category still
renders correctly in analytics and detail views. Warn on deactivation and explain this.
```

### Prompt 37 — Settings: rating scale, branding, contact
```
Build /admin/settings/rating-scale (face_key picker, label, colour, value), /admin/settings/branding
(logo upload to Supabase Storage, website, Instagram handle + URL, other socials), and
/admin/settings/contact (grievance officer name, phone, email). All feed the kiosk footer and
grievance block live. Include a colour picker constrained to accessible contrast.
```

### Prompt 38 — Settings: thresholds, alerts, rewards, privacy
```
Build /admin/settings/system: category attention thresholds, insight sensitivity, alert rules
and cooldowns, data retention policy, and the Rewards block — enabled toggle, amount, wallet
provider — shipped OFF per CLAUDE.md §12. Wire the reward config into the journey as a
no-op branch point so it can be switched on later without touching the feedback flow.
```

### Prompt 39 — Users & roles
```
Build /admin/users: invite, edit, deactivate, assign role (OWNER, ADMIN, MANAGER, STAFF).
OWNER/ADMIN only. Verify the §8 matrix is enforced in RLS as well as the UI — write a test
that logs in as each role and asserts what it can and cannot reach.
```

### Prompt 40 — Reports
```
Build /admin/reports per §38: Daily, Weekly, Monthly and Guest reports.
Daily: total feedback, average ratings, positive/neutral/negative split, complaints,
follow-ups, top issues, top compliments.
Weekly: week-on-week comparison, category trends, top complaints, top compliments, repeat
guest trends. Monthly: month-on-month, overall satisfaction, category performance, complaint
resolution, repeat guests, trends. Guest: individual histories.
Each renders on screen and prints cleanly to PDF via a print stylesheet.
```

### Prompt 41 — Excel export
```
Build GET /api/export per CLAUDE.md §10 using ExcelJS. Six sheets exactly: Feedback, Guests,
Ratings Summary, Issues, Follow-ups, Daily Summary. Support scope=current (respects active
filters) and scope=all, with a date range.

Frozen bold header row, auto-width, dd-MMM-yyyy dates. Filename
AIC-Feedback-{from}-to-{to}.xlsx. Stream it — do not buffer the whole workbook in memory.

Role-restricted per §11: full phone numbers only for OWNER/ADMIN, masked for MANAGER, no
export for STAFF. Every export writes an audit_log row.
```

---

# PHASE G — HARDENING (42–44)

### Prompt 42 — Privacy & security pass
```
Audit the whole codebase against CLAUDE.md §11 and §7 RLS:
- confirm SUPABASE_SERVICE_ROLE_KEY never reaches a client bundle (grep the build output)
- phone masking applied at the query layer, not just in the UI
- consent language present and legible on the contact screen
- retention purge job implemented as a scheduled function, driven by the config value
- audit_log written on every unmask, export, config change and follow-up transition
- rate-limit POST /api/feedback per kiosk to stop abuse
Report findings as a checklist with pass/fail before fixing.
```

### Prompt 43 — Kiosk hardening
```
Harden the kiosk for unattended operation:
- offline queue: if the network drops, store the submission in IndexedDB and retry on reconnect;
  the guest still sees the thank-you screen
- crash boundary that resets to Welcome rather than showing an error to a guest
- kiosk heartbeat updating kiosks.last_seen_at, surfaced in admin as an online/offline badge
- prevent double submission and back-button re-entry into a completed journey
- verify no scrolling, no zoom, no browser chrome exposure at 1080x1920
- lighthouse pass: kiosk bundle small, first paint fast on a mid-range tablet
```

### Prompt 44 — Final QA 🔍
```
Full acceptance pass against the PDF spec. Produce a written checklist covering every section
§1–§48 with PASS / FAIL / PARTIAL and a note for each.

Verify specifically:
- every string in §5 matches the PDF verbatim
- zero hard-coded customer-facing strings anywhere (grep and prove it)
- no bare metric rendered without a comparison
- the ten non-negotiables in CLAUDE.md §14, each explicitly addressed
- the 60-second test: open the dashboard cold and confirm the state of the café is legible

Then write README.md: setup, env vars, migration order, deploy to Vercel, kiosk tablet setup
(kiosk-mode browser, portrait lock, home screen, auto-restart), and a one-page manager guide
for the CMS.

STOP. Final review with me before deploy.
```

---

# PHASE H — MEMORY PRINT MODULE (45–52)

> Read `PHOTO_MODULE.md` in full before Prompt 45. Hardware is confirmed: Windows 11 IoT,
> i3 / 8GB, integrated front camera, built-in 80mm thermal printer with auto-cutter.

### Prompt 45 — Schema, config & kill switch
```
Read PHOTO_MODULE.md fully.

Write migration 0014_memory_module.sql per PHOTO_MODULE.md §8.
(NOT 0006 — that number is taken by 0006_retention_and_rate_limit. 0001-0013 are applied.)
- kiosks gains printer_status, camera_status, agent_version, status_checked_at
- feedback gains memory_offered, memory_printed, memory_retries

There must be NO image column and NO storage bucket anywhere. The photo never reaches this
database. If you find yourself adding a column to hold an image, stop — that is a spec
violation, not an optimisation.

Seed the app_config 'memory' section with every key and every copy string from
PHOTO_MODULE.md §9, using caption_line option 1. Include memory.enabled as a master kill
switch, default true, toggleable from admin settings.

app_config's PK is (outlet_id, key) — seed per outlet, not globally.

Every one of these strings is authored rather than §5 locked copy, so register them in
AUTHORED_KEYS in tests/db/0002-seed.test.ts or the §5 drift check will fail the build. It
checks every migration, not just 0002.

Extend lib/config.ts with a typed MemoryConfig. Regenerate database types AND
lib/config.defaults.ts (scripts/generate-config-defaults.mjs).
```

### Prompt 46 — Print agent: image pipeline 🔍
```
Create a separate workspace package `agent/` — a Node 20 + TypeScript service that runs ON THE
KIOSK PC ONLY. It is never deployed to Vercel. Use sharp for imaging.

Build lib/pipeline.ts implementing PHOTO_MODULE.md §4 in exact order: crop 4:5 → luminance
grayscale → auto-levels (clip 0.5% tails) → CLAHE (clip 2.0, 8x8) → unsharp (r1.0, a0.6) →
gamma 1.2 → downscale 512px Lanczos → ATKINSON dither to 1-bit.

Implement Atkinson yourself — sharp has no 1-bit dither. Diffuse only 3/4 of the error
(1/8 to each of 6 neighbours). Do NOT substitute Floyd-Steinberg: it goes grey and muddy on
thermal paper, Atkinson goes punchy and graphic. This choice IS the product's look.

Every parameter reads from agent/config.json so it can be tuned on-site against the café's real
evening lighting without a rebuild.

Add a CLI: `pnpm pipeline:preview <input.jpg>` writing a 576px PNG preview.

STOP. Run 5–6 real photos taken in dim indoor light through it and show me the previews.
The pipeline is the whole product — I want to see faces come out legible before we print.
```

### Prompt 47 — Print agent: composition & ESC/POS
```
Build agent/lib/compose.ts producing ONE 576-wide 1-bit bitmap per PHOTO_MODULE.md §5:
32px top margin, thermal logo (max 320w), 512x640 photo centred, 90px WHITE GAP (this is the
polaroid tell — do not shrink it), caption, footer line.

Caption and footer render as bitmap text from an embedded font, NOT ESC/POS font codes — the
whole print must be a single raster so alignment cannot drift.

Build agent/lib/printer.ts sending it as one `GS v 0` raster over USB, followed by feed and
auto-cut. Handle OUT_OF_PAPER, COVER_OPEN, OFFLINE as distinct typed errors.

Add `pnpm print:test <input.jpg>` for on-site calibration.
```

### Prompt 48 — Print agent: service & API
```
Build the agent HTTP server per PHOTO_MODULE.md §6:
- binds 127.0.0.1 ONLY, never 0.0.0.0
- GET /status → { ok, printer, paper, camera, version }
- POST /print { jpegBase64, caption, dateLabel, copies } → { ok, ms } | { ok, reason }
- single-flight queue, one job at a time
- NO disk writes ever: no temp files, no logs containing image data. Explicitly zero buffers
  after each print.
- structured logs of events and errors only, never payloads
- CORS allowing only the kiosk origin

Package as a Windows service with auto-restart (node-windows). Write agent/README.md covering
install, the Chrome launch flags from PHOTO_MODULE.md §2, printer driver setup, and
config.json tuning.
```

### Prompt 49 — Kiosk: capture screen 🔍
```
Build app/(kiosk)/memory/page.tsx per PHOTO_MODULE.md §3 and §7.

CRITICAL ORDERING: this route only mounts after POST /api/feedback has returned a
feedbackCode. If someone lands here without one, redirect to /thanks. The feedback is already
safe before the camera ever opens.

- getUserMedia 1920x1080, facingMode user
- preview MIRRORED (people expect a mirror)
- capture UNMIRRORED from the full-resolution stream, never the preview element — otherwise
  text on clothing prints backwards
- 4:5 portrait frame guide, wide enough for four people at a table
- 5s countdown, large numerals
- SCREEN FLASH FILL LIGHT: ramp the page to near-white at full brightness for the final 1.5s.
  The 24" panel is the softbox. Underexposed input cannot be rescued downstream.
- release the camera track the moment the journey ends — the LED going dark matters to people

Copy from config.memory. Offer screen uses the negative_* variants when the feedback hit the
negative branch: same gift, sincere register instead of upbeat. SKIP is equally weighted, never
a small grey link.
```

### Prompt 50 — Kiosk: review, print & graceful failure
```
Build the review step (RETRY, capped at max_retries=3, then KEEP is the only option) and the
printing step.

POST to http://127.0.0.1:9100/print with the unmirrored JPEG, resolved caption and date label.
Show a progress state and "collect your print below", then continue to /thanks.

FAILURE HANDLING — no camera permission, agent unreachable, out of paper, timeout: route
SILENTLY to the normal thank-you screen. Never show a guest an error message about a free
gift. Log it, badge it in admin, move on.

Update feedback.memory_offered / memory_printed / memory_retries via a small PATCH route —
PATCH /api/feedback/[id]/memory, with an RLS policy scoped to those three columns on that one
row, keyed by the submission_id the kiosk already holds.

Do NOT reuse POST /api/feedback's service-role client for this. That client can insert guests
and feedback; it is far too much privilege for setting three booleans, and reaching for it
because it is already wired up is how a narrow write becomes a wide hole.

Nothing else about the photo is ever written.

Verify the whole module hard-disables when config.memory.enabled is false — the journey must
go straight from contact to thanks with no trace.
```

### Prompt 51 — Admin: device health & uptake
```
- Kiosk heartbeat: poll GET /status on boot and every 5 min, PATCH results to kiosks.
- Admin header badge: "Kiosk printer offline" / "Out of paper" — visible immediately, not
  discovered three days later.
- Settings > Memory: all copy strings with live preview, countdown seconds, max retries,
  caption line, pipeline parameters, and a THERMAL LOGO upload slot separate from the web logo
  (per PHOTO_MODULE.md §5 the thermal logo is a hand-prepared 1-bit asset — warn the user that
  auto-converting a vector will not work at 203dpi).
- KILL SWITCH per PHOTO_MODULE.md §8b — build all three layers:
  1. Master enable toggle. Off = the module vanishes from the journey. Camera never requested,
     no permission prompt, no LED, offer line gone from welcome, /memory redirects out. A guest
     must not be able to tell the feature exists.
  2. Auto-disable after N consecutive print failures (configurable, default 3), raising an
     alert. Re-enable is manual only — never silently self-restore.
  3. Optional schedule windows (hours/days), off by default.
  Toggling calls revalidateTag('config') so it takes effect within seconds, no redeploy, no
  restart. The kiosk re-reads config at the start of every journey and never caches
  memory.enabled across journeys. Every toggle writes audit_log with actor and manual/auto.
- Put a one-tap "Turn off memory prints" control ON the device-health header badge, not only
  in settings — a manager with a jammed printer at 9pm should not have to hunt for it.
- Dashboard metric: memory print uptake % and prints today, plus paper consumption estimate.
- An insight card if uptake drops sharply — usually means the printer is failing silently.
```

### Prompt 52 — Module QA 🔍
```
Acceptance pass on the Memory Print Module. Produce a PASS/FAIL checklist proving:

1. FEEDBACK COMMITS FIRST — kill the agent, revoke camera permission, pull the paper roll.
   In every case the feedback row still lands in Supabase and the guest reaches thank-you.
2. THE IMAGE NEVER LEAVES THE MACHINE — grep the codebase and inspect network traffic during a
   full run. Prove no image data goes to Vercel, Supabase, or any origin other than
   127.0.0.1:9100. Prove nothing is written to disk.
3. UNCONDITIONAL — submit all-1s and all-5s feedback and confirm the offer, the flow and the
   print are identical apart from the negative-branch copy variant. Confirm the keepsake is
   never mentioned on any rating or issue screen. This is CLAUDE.md non-negotiable #3.
4. Mirroring is correct: hold text up to the camera, confirm it prints readable.
5. Retry cap enforced at 3.
6. KILL SWITCH, all three layers:
   - master off → module fully absent from the journey, camera never requested, no permission
     prompt, no LED, no offer line on welcome, /memory redirects out
   - toggle takes effect on the kiosk within seconds without redeploy or restart
   - auto-disable fires after N consecutive print failures and does NOT self-restore
   - schedule windows respected when enabled

Then update README.md with kiosk PC setup: Windows service install, Chrome flags, printer
drivers, daily open checklist (wipe the camera lens, check the paper roll), and paper
specification — BPA-free, top-coated.

STOP. Final review with me.
```

---

## Memory module checkpoints

| Prompt | Checkpoint |
|---|---|
| 46 | Real dim-light photos through the pipeline — faces legible before anything prints |
| 49 | Capture screen on the actual kiosk, correct framing and fill light |
| 52 | The three rules proven, not asserted |

---

## Checkpoint summary

| Prompt | Checkpoint |
|---|---|
| 06 | Visual language approved before any screen is built |
| 10 | Rate screen on the real kiosk hardware |
| 17 | Full kiosk journey end-to-end, row in Supabase |
| 23 | Dashboard passes the 60-second test |
| 35 | CMS edit changes the kiosk with no redeploy |
| 44 | Full spec acceptance (core system) |
| 46 | Image pipeline output on real photos |
| 49 | Capture screen on real hardware |
| 52 | Memory module acceptance |

## If you only have time for a walking skeleton
Prompts **01–05, 07–17, 18–19, 23, 29, 41** gives a live kiosk, a basic dashboard and Excel
export. Everything else is intelligence layered on top of a working spine.
