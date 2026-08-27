# CLAUDE.md — All India Café: Customer Experience Intelligence System (Phase 1)

> **Read this file completely before writing any code.**
> This is not a feedback form. It is a Customer Experience Intelligence System.
> Kiosk = data collection. Backend = data structuring. Analytics = intelligence. Dashboard = decision-making.

---

## 0. PROJECT IDENTITY

| Field | Value |
|---|---|
| Client | All India Café (AIC) |
| Built by | Vibrnd |
| Product | Customer Experience Intelligence System (CXIS) |
| Phase | 1 — Complete build |
| Repo name | `aic-cxis` |
| Kiosk URL | `feedback.allindiacafe.in` (vertical touchscreen at exit door) |
| Admin URL | `feedback.allindiacafe.in/admin` |

---

## 1. TECH STACK — NON-NEGOTIABLE

```
Framework      Next.js 15 (App Router, Server Components by default)
Language       TypeScript (strict: true, no `any`)
Styling        Tailwind CSS v4
UI primitives  shadcn/ui (Radix)
Database       Supabase (Postgres 15) + Row Level Security
Auth           Supabase Auth (email + password, admin/staff only — kiosk is public)
Charts         Recharts
Excel          ExcelJS (server-side route handler, streams .xlsx)
Forms          react-hook-form + zod
State          React Server Components + minimal client state. NO Redux, NO Zustand.
Dates          date-fns + date-fns-tz (timezone: Asia/Kolkata, ALWAYS)
Deploy         Vercel
Icons          lucide-react
Fonts          Kiosk headings: a warm display serif. Body/UI: Inter or Geist.
```

**Package manager:** `pnpm`.

---

## 2. REPO STRUCTURE

```
aic-cxis/
├── app/
│   ├── (kiosk)/                    # PUBLIC — no auth, no nav chrome
│   │   ├── layout.tsx              # portrait lock, footer, idle-reset provider
│   │   ├── page.tsx                # Screen 01 — Welcome
│   │   ├── rate/page.tsx           # Screen 02 — Main feedback (all 4 categories)
│   │   ├── issues/page.tsx         # Negative pathway
│   │   ├── loved/page.tsx          # Positive pathway
│   │   ├── comment/page.tsx        # General comments
│   │   ├── followup/page.tsx       # Would you like us to follow up?
│   │   ├── contact/page.tsx        # Name optional, phone required (§4)
│   │   └── thanks/page.tsx         # Screen 05 — Final thank you + grievance
│   ├── (admin)/admin/
│   │   ├── layout.tsx              # auth guard + sidebar
│   │   ├── page.tsx                # Today at a Glance
│   │   ├── feedback/page.tsx       # list + filters
│   │   ├── feedback/[id]/page.tsx  # detail + follow-up workflow
│   │   ├── guests/page.tsx
│   │   ├── guests/[id]/page.tsx    # profile + experience journey
│   │   ├── analytics/page.tsx      # trends, comparisons, comment intelligence
│   │   ├── reports/page.tsx
│   │   ├── settings/…              # CMS — see §7
│   │   └── users/page.tsx          # role management (OWNER/ADMIN only)
│   ├── api/
│   │   ├── feedback/route.ts       # POST — single atomic submit
│   │   ├── export/route.ts         # GET — 6-sheet xlsx
│   │   └── alerts/route.ts         # GET — active alerts poll
│   └── layout.tsx
├── components/
│   ├── kiosk/                      # EmojiScale, CategoryCard, ChipGrid, BigButton, KioskFooter
│   ├── admin/                      # KpiCard, InsightCard, TrendChart, StatusBadge, DateRangeFilter
│   └── ui/                         # shadcn
├── lib/
│   ├── supabase/                   # server.ts, client.ts, admin.ts (service role)
│   ├── analytics/                  # metrics.ts, insights.ts, themes.ts, comparison.ts
│   ├── queries/                    # typed server-side data access, comparison-enriched
│   ├── config.ts                   # CMS config loader (cached)
│   ├── session.ts                  # kiosk draft session (sessionStorage)
│   ├── time.ts                     # Asia/Kolkata helpers — the ONLY source of business dates
│   ├── journey.ts                  # §4 branch routing
│   ├── permissions.ts              # can(user, action) — §8 matrix
│   └── validation.ts               # zod schemas
├── supabase/migrations/
├── types/database.ts               # generated: supabase gen types typescript
└── CLAUDE.md
```

---

## 3. THE PRIME DIRECTIVE — EVERYTHING IS DYNAMIC

**Zero customer-facing string may be hard-coded.** Every heading, subheading, CTA label, placeholder, supporting line, emoji, colour, category name, question, chip label, thank-you message, phone number and social URL is read from the database at runtime and editable in the admin CMS.

Implementation:
- Table `app_config` (key/value JSONB, namespaced by `section`).
- `lib/config.ts` exports `getConfig()` — a cached server function returning a fully typed config object.
- Migration seeds **the exact copy in §5 below** as defaults.
- Every kiosk component receives its copy as props. If a component contains a literal user-facing string, that is a bug.

Same rule for categories, rating scale, and issue chips — all DB rows with `display_order` and `active`, all CRUD-able and reorderable.

---

## 4. KIOSK — CUSTOMER JOURNEY

Five emotional stages: **WELCOME → AGENCY → EXPRESSION → RESOLUTION → APPRECIATION**
Emotional arc: **Empowered → Safe → Heard → Acknowledged → Appreciated**

```
[01 WELCOME]
      ↓ SHARE YOUR FEEDBACK →
[02 RATE]  all 4 categories on ONE screen
      ↓ CONTINUE →
      ├─ any rating ≤ 2 ──→ [NEGATIVE: "Thank you for telling us" → issue chips → tell us more]
      └─ predominantly 4–5 → [POSITIVE: "That's wonderful to hear" → what did you love most]
      ↓
[GENERAL COMMENT]  optional — folded into the branch screen above, not its own step
      ↓
[CONTACT]  name optional, phone REQUIRED (client decision — see below)
      ↓
  ✅ COMMIT to Postgres  ← feedback is saved HERE, before the photo module
      ↓
[MEMORY PRINT MODULE]  see PHOTO_MODULE.md — optional, skippable, non-blocking
      ↓
[05 THANK YOU]  + grievance officer
      ↓ auto-reset to Welcome after 8s (configurable)
```

**The follow-up screen is cut.** The brief had a `WOULD YOU LIKE US TO FOLLOW UP?`
step between the comment and the contact screen. It asked for consent to make
contact and was immediately followed by a screen asking for a phone number —
the same question twice, and the second one is the only one that produces
anything actionable. A callback is now **inferred**: a guest who had a bad visit
and still leaves a number is asking to be contacted about it. A guest who had a
good visit and leaves one is joining the mailing list, which is a different
thing and must not open a case nobody needs to chase. See §9 for what this does
to the follow-up metrics — it changes their meaning, not just their plumbing.

**Routing rules**
- Negative pathway triggers when **any single category rating ≤ 2**.
- Positive pathway when **average ≥ 4 and no rating ≤ 2**.
- Mixed/neutral (avg 3–3.9, none ≤2) → skip both branches, go straight to general comment.
- **`follow_up_requested` is derived, never asked:** `sentiment === 'negative' && phone !== ''`.
  On the negative branch the contact screen shows a variant subheading explaining why a number
  helps, but the field stays optional and SKIP stays exactly as reachable. Never `required`.
- **Contact details are compulsory.** `contact.required` (default true) requires a valid mobile
  number to leave the contact screen, and SKIP is not shown. This is a client decision taken on
  27 Aug 2026 and it REVERSES the brief, which said the phone was optional always and SKIP was
  permanently visible. It is a config key rather than deleted code, so it can be turned back off
  from Settings without a deploy.

  Two consequences, both handled and neither to be undone casually:

  - A guest who will not give a number has no way forward, so they leave. The submit fires on
    leaving the contact screen, so their ratings would go with them — the idle reset therefore
    commits the draft before wiping it. **Do not remove that rescue without restoring SKIP.**
  - The guests least willing to be identified are the ones whose feedback is most candid. Expect
    the response rate to fall and the remaining sample to skew positive; §14.2 and §14.3 are
    about not distorting what guests tell you, and this pulls against them. Worth watching in the
    first fortnight against the uptake numbers on the dashboard.

**Session handling:** the whole journey is one draft object in `sessionStorage`. Nothing is written to Postgres until the final submit on the thank-you transition — one atomic `POST /api/feedback`. Idle timer (90s, configurable) resets to Welcome and clears the draft, so the next guest never sees the previous guest's answers.

---

## 5. LOCKED COPY (seed values — verbatim)

Preserve this language exactly. It may only change through the CMS.

**Screen 01 — Welcome**
- H1: `YOUR EXPERIENCE MATTERS.`
- H2: `Tell us how we did.`
- Support: `Your feedback helps us make All India Café better.`
- CTA: `SHARE YOUR FEEDBACK →`
- Micro: `It takes less than a minute.`
- ✗ Never "Please rate us." ✗ Never ask for personal info on this screen.

**Screen 02 — Main Feedback**
- H1: `HOW DID WE DO?`
- Sub: `Good, bad or somewhere in between — tell us honestly.`
  *(This line is load-bearing — it grants explicit permission to criticise. Do not soften it.)*
- CTA: `CONTINUE →`

**Default categories**
| Order | Name | Question | Icon |
|---|---|---|---|
| 1 | FOOD | How did your food make you feel? | utensils |
| 2 | SERVICE | How was the service you received? | concierge-bell |
| 3 | HOSPITALITY | How did our team make you feel? | heart-handshake |
| 4 | AMBIENCE | How did you find the ambience & cleanliness? | sparkles |

**Rating scale (5 rows, seeded)** — matches the client's reference image

| Value | Face | Label | Colour | Expression |
|---|---|---|---|---|
| 1 | `angry` | Very Poor | `#E63329` red | furrowed angled brows, deep frown |
| 2 | `sad` | Poor | `#F07829` orange | flat brows, shallow frown |
| 3 | `neutral` | Okay | `#F5C518` yellow | no brows, straight horizontal mouth |
| 4 | `happy` | Good | `#8DC63F` light green | no brows, gentle upward smile |
| 5 | `delighted` | Excellent | `#39B54A` green | curved-arc closed eyes, wide open smile |

**Render these as inline SVG components, not Unicode emoji.** Store `face_key` in the DB (`angry`/`sad`/`neutral`/`happy`/`delighted`), not a glyph. Unicode emoji render differently on every OS and tablet font stack — the guest must see exactly the same five faces every time, and the client has approved a specific look.

**Visual spec, from the approved reference:**
- Solid filled circle, no outline, no gradient, no drop shadow
- Face features are **cut out of the circle in white** (eyes and mouth are negative space), not drawn in a darker tint
- Eyes are simple ovals; the mouth is a single thick stroke or filled shape
- Only faces 1 and 2 have eyebrows — 3, 4 and 5 have none
- All five in a **single horizontal row**, equal size, equal spacing, question heading above
- Faces are flat and friendly — no 3D shading, no bevel, no gloss

**Note on the PDF:** §5 of the brief specifies red / red / yellow / green / green. The approved reference image uses a smoother five-step ramp (red → orange → yellow → light green → green). Seed the ramp above — it preserves the brief's red → yellow → green emotional read while making each step distinguishable at a glance. The colour column is CMS-editable either way.

The face is the **primary** interaction. **Never use stars.** Colour must register before the label does.

**Negative pathway**
- H1: `THANK YOU FOR TELLING US.`
- Sub: `We'd rather know when something wasn't right.`
- H2: `WHAT HAPPENED?`
- The first response is never defensive. It moves the guest from anger → expression.
- Issue chips (multi-select, configurable): Food, Service, Staff, Waiting Time, Cleanliness, Billing, Ambience
- H3: `TELL US MORE`
- Support: `You don't have to explain everything. Even a few words help.`

**Positive pathway**
- H1: `THAT'S WONDERFUL TO HEAR! ❤️`
- Sub: `We're glad you had a great experience at All India Café.`
- H2: `WHAT DID YOU LOVE MOST?`
- Chips: Food, Service, Our Team, Ambience, The Experience

**General comment**
- H1: `IS THERE ANYTHING ELSE YOU'D LIKE US TO KNOW?`
- Support: `A compliment, a suggestion or something we could have done better — we'd love to hear it.`
- Placeholder: `YOUR THOUGHTS...`
- Badge: `Optional` — visible, never hidden.

**Follow-up — REMOVED.** The brief's §11 screen (`WOULD YOU LIKE US TO FOLLOW UP?` /
`YES, PLEASE` / `NO, I'M GOOD`) is cut, along with its `followup.*` config section. See §4.
The principle it carried survives and still binds the contact and issue screens: this is
resolution, not escalation — ✗ never "lodge a complaint", ✗ never "speak to the manager".

**Contact**
- H1: `WE'D LOVE TO STAY CONNECTED ❤️`
- Support: `As a valued customer, we'd love to keep you updated with special offers, new experiences and what's happening at All India Café.`
- Fields: `Your Name`, `Mobile Number`
- CTA: `KEEP ME CONNECTED →` / Secondary: `SKIP` — **SKIP is no longer rendered** while
  `contact.required` is true (§4). The copy stays seeded so turning the setting back off restores
  the button without a migration.
- Micro: `We'll use this only to reach you about your visit.`
  *(Was `Optional — you can skip this step.` — reseeded in 0018. The screen is no longer optional
  and the line could not go on saying that it was. The old string stays recorded here so reverting
  `contact.required` has a copy to revert to.)*

**Screen 05 — Thank you**
- H1: `THANK YOU FOR BEING HEARD. ❤️`
- Body: `Your feedback helps us make All India Café better for you — and for everyone who walks through our doors.`
- Line: `You spoke. We listened.`
- Support: `We look forward to serving you better next time.`

**Grievance block (bottom of thank-you)**
- `NEED TO SPEAK TO SOMEONE?` / `Our Grievance Officer is here to listen.` / `📞 {config.grievance.phone}` → `tel:` link.

**Persistent footer (every screen)**
`All India Café · Website · Instagram · Grievance Officer` — all URLs/numbers from config.

---

## 6. KIOSK DESIGN CONSTRAINTS

- **Confirmed hardware:** 24" FHD all-in-one, portrait floor stand, **Windows 11 IoT**, Intel
  i3 (11th gen), 8GB/128GB, integrated front camera, built-in 80mm thermal printer with
  auto-cutter, 2D barcode scanner (unused in Phase 1).
- **Portrait / vertical only.** Design at 1080×1920. Do not make a desktop site responsive — this is a dedicated kiosk app.
- **1080×1920 is a DEVICE resolution, not a CSS one.** The 24" panel reports a 1080×1920 CSS
  viewport at devicePixelRatio 1; a DPR-2 tablet reports 540×960 for the same pixels. Author
  everything in design pixels against the `--kpx` unit
  (`min(100dvh / 1920, 100dvw / 1080)`) so one layout is correct on both. A build that
  hard-codes px measures correctly in a 1080×1920 browser window and then overflows the real
  device — that failure has already happened once here.
- **Calibrate type for a 24" panel viewed standing at arm's length**, not a tablet held at
  reading distance. The minimums below are floors, not targets — verify on the real screen.
- Tap targets **minimum 88×88px**. Emoji buttons ~140px.
- Typography large: H1 ≥ 56px, body ≥ 24px, never below 20px.
- High contrast. Minimal text per screen. **One obvious CTA.**
- **No scrolling** on any screen except the comment screen when the keyboard is open.
- Selected state must be unmistakable: enlarged face + coloured ring + subtle scale animation + haptic-style confirmation. Animations ≤ 200ms — premium and immediate, never bouncy or excessive.
- On-screen keyboard: rely on OS keyboard; ensure inputs scroll into view above it.
- Premium Indian visual identity — warm, considered, not clip-art "Indian". Think ivory/cream ground, deep ink text, a single warm accent (terracotta/saffron), generous whitespace.
- `user-select: none`, disable right-click, disable pull-to-refresh, `overscroll-behavior: none`.
- Must function on an average tablet browser. No WebGL, no heavy libs on the kiosk bundle.

---

## 7. DATABASE SCHEMA

All tables carry `outlet_id` from day one (§43 multi-outlet readiness) even though there is one café today.

```sql
outlets       (outlet_id, name, code, city, active, created_at)
kiosks        (kiosk_id, outlet_id, label, active, last_seen_at)

guests        (guest_id, outlet_id, guest_code /* AIC-000001 */, name, phone /* UNIQUE per outlet */,
               first_feedback_date, last_feedback_date, total_feedbacks, average_rating,
               created_at, updated_at)

feedback      (feedback_id, feedback_code /* AIC-20260823-00125 */, outlet_id, kiosk_id, guest_id NULL,
               submission_id uuid /* client-generated idempotency key — UNIQUE per outlet */,
               submitted_at timestamptz, local_date date, local_time time, day_of_week int, hour_bucket text,
               overall_score numeric(3,2), sentiment text, comment text,
               follow_up_requested bool, status text /* denormalised mirror — see Notes */, created_at)

feedback_ratings (feedback_id, category_id, rating int CHECK 1..5)   -- PK (feedback_id, category_id)
feedback_issues  (feedback_id, issue_id)                              -- PK (feedback_id, issue_id)
feedback_themes  (feedback_id, theme_id, mentions int)                -- PK (feedback_id, theme_id)

categories    (category_id, outlet_id, name, question, icon, display_order, active)
issues        (issue_id, outlet_id, name, icon, kind /* 'negative' | 'positive' */, display_order, active)
rating_scale  (scale_id, outlet_id, value int, face_key, label, colour, active)
                                        -- UNIQUE (outlet_id, value)
                                        -- face_key ∈ angry|sad|neutral|happy|delighted

themes        (theme_id, outlet_id, name, kind /* 'negative' | 'positive' */, display_order, active)
theme_keywords(keyword_id, theme_id, keyword text, active)   -- UNIQUE (theme_id, lower(keyword))

follow_ups    (follow_up_id, outlet_id, feedback_id UNIQUE, guest_id, status, assigned_to,
               resolution, created_at, updated_at, resolved_at)
follow_up_notes (note_id, follow_up_id, author_id, body text, created_at)

app_config    (outlet_id, key, section, value jsonb, updated_at, updated_by)  -- PK (outlet_id, key)
app_users     (user_id /* = auth.uid */, outlet_id, name, email, role, active)
alerts        (alert_id, outlet_id, type, severity, dedupe_key text, title, body, payload jsonb,
               first_fired_at, last_fired_at, cooldown_until, acknowledged_at, acknowledged_by, created_at)
audit_log     (id, outlet_id, user_id, action, entity, entity_id, before jsonb, after jsonb, created_at)
```

**Notes**
- `local_date`, `local_time`, `day_of_week`, `hour_bucket` are computed at insert in **Asia/Kolkata** and stored denormalised — every dashboard query filters on these, never on raw UTC.
- `hour_bucket` ∈ `12-15`, `15-18`, `18-21`, `21-24`, `other` (§33).
- `overall_score` = mean of that submission's category ratings, stored at write time.
- Guest aggregates (`total_feedbacks`, `average_rating`, dates) maintained by a Postgres trigger on `feedback` insert — never recomputed in app code.
- Phone is the **unique guest key** (§13). Same phone → attach to existing guest. New phone → create guest with next `guest_code`. No phone → feedback saved with `guest_id = NULL` (anonymous, still fully counted in analytics).
- **Status has one owner.** `follow_ups.status` ∈ `OPEN | CONTACTED | RESOLVED | CLOSED` is the single
  source of truth for the resolution workflow. `feedback.status` ∈ `NEW | OPEN | CONTACTED | RESOLVED |
  CLOSED` is a **denormalised mirror** maintained by a trigger on `follow_ups` — it exists so the feedback
  list can filter and sort in one indexed scan. Feedback with no `follow_ups` row stays `NEW`. Never write
  `feedback.status` from app code.
- **Submission is idempotent.** The kiosk generates a `submission_id` (uuid v4) when the draft is created and
  sends it with the submit. `UNIQUE (outlet_id, submission_id)` makes a double-tap, a retry from the offline
  queue (§43) and a back-button re-entry all collapse to one row; `POST /api/feedback` returns the existing
  `feedback_code` on conflict rather than erroring.
- **Alerts deduplicate on `dedupe_key`.** The evaluator composes a stable key per condition
  (e.g. `LOW_RATING_CLUSTER:service:2026-08-23T19`). A partial unique index on `(outlet_id, dedupe_key)`
  `WHERE acknowledged_at IS NULL` keeps one open row per live condition: a re-fire inside `cooldown_until`
  updates `last_fired_at` and the payload instead of inserting. Acknowledging closes the row and lets the
  condition fire fresh afterwards.
- **Themes are DB rows, not code.** `themes` + `theme_keywords` hold the keyword→theme lexicon of §9, seeded by
  migration and CRUD-able from settings like every other reference table. `feedback_themes` is written at
  submit time by the extractor so analytics aggregates in Postgres instead of re-scanning comment text. The
  verbatim `feedback.comment` is never modified — themes are an index over it, never a replacement for it.
- **Internal notes are a thread.** `follow_up_notes` is append-only, one row per note, with author and
  timestamp (§28 requires a timestamped thread — a single text column cannot carry one).
- **Every table carries `outlet_id`**, including `rating_scale`, `themes`, `app_config`, `follow_ups` and
  `audit_log`. Reference tables are per-outlet from day one so a second café can diverge on copy, categories
  and colours without a migration (§43).

**RLS**
- `feedback`, `guests`, all config tables: no anon read. Ever.
- Kiosk submits via `POST /api/feedback` using the **service role key server-side only** — the service key must never reach the browser.
- Kiosk reads config via a server component, not a client-side Supabase call.
- Admin reads scoped by `outlet_id` of the requesting `app_users` row.

---

## 8. ROLES (§42)

| Role | Access |
|---|---|
| OWNER | Everything |
| ADMIN | Everything except billing/user deletion — system configuration owner |
| MANAGER | Dashboard, feedback, guests, follow-ups, reports, export. No CMS, no users. |
| STAFF | Only follow-ups assigned to them + feedback list (read). No guest phone numbers, no export. |

Enforce in **both** RLS policies and route guards. Never rely on UI hiding alone.

---

## 9. ANALYTICS ENGINE (§35–37)

Pure functions in `lib/analytics/`, unit-tested.

| Metric | Formula |
|---|---|
| Average Rating | Σ ratings / count |
| Positive % | ratings 4–5 / total |
| Negative % | ratings 1–2 / total |
| Neutral % | ratings 3 / total |
| Complaint Rate | negative feedbacks / total feedbacks |
| Contactable Complaint Rate | negative feedbacks **with a phone** / negative feedbacks |
| Resolution Rate | resolved / total complaints |
| Avg Resolution Time | mean(`resolved_at - created_at`) |
| Repeat Guest % | guests with >1 feedback / identified guests |

**Comparison engine (§36):** every KPI must return `{ value, previous, delta, deltaPct, direction }` for: Today vs Yesterday · Today vs 7-day avg · This week vs Last · This month vs Last · Custom vs preceding equal period.

> Never render a bare number. `Service = 4.1` is a failure. `Service 4.1 ↓ 11% vs previous 7 days` is the product.

**On the follow-up metrics.** The brief's *Follow-up Rate* was
`follow-up requests / total feedbacks`, and it meant something real while a guest could tap
`YES, PLEASE`: it measured demand for contact. With that screen cut (§4) nobody requests
anything, so the numerator became "negative AND left a phone" — a strict subset of the
complaint numerator. Kept as-is it would be a metric that is mathematically incapable of
exceeding Complaint Rate, sitting next to it on the same row, with a name claiming guests
asked for something none of them were offered.

So it is **redefined, not renamed**: `Contactable Complaint Rate` divides reachable complaints
by *complaints*, not by all feedback. That asks a question a manager can act on — "of the
guests whose visit went wrong, what share can we actually call?" — and it is independent of
Complaint Rate rather than nested inside it. A low value is a contact-screen problem, not a
service problem.

`Resolution Rate` is unaffected: it already divides by complaints. The **Follow-ups required**
count is unaffected and stays the volume number. The guest filter **Follow-up Required**
(`an open follow_ups row`) is unaffected in definition, but its population narrows — read it
as *unresolved complainant*, since a delighted guest can no longer open a case.

**Known gap this leaves.** With the opt-in gone, `follow_ups` rows are created in exactly one
place — `POST /api/feedback` when the derived flag is true. Staff cannot open a case by hand,
so a scathing comment from a guest who rated everything 3/5 has no route into the workflow.
Building `openFollowUp(feedbackId)` as a MANAGER+ action closes it. Until then, "or by staff
action" is not true of this system.

**Auto-generated insights (§21, §37).** The system generates these itself — they are not hand-written:
- `CATEGORY_DROP` — category down > X% vs previous period
- `ISSUE_SPIKE` — issue mentions up > X% vs 7-day average
- `LOW_RATING_CLUSTER` — N feedbacks ≤ 2 on a category today
- `CATEGORY_STRONG` — category up and above threshold
- `THEME_EMERGING` — comment theme mentions rising

Every insight card answers: *What happened? How significant? Improving or worsening? Why? What next?* — and ends with a `VIEW FEEDBACK →` deep link into a pre-filtered feedback list.

**Comment intelligence (§26).** Phase 1 = keyword/lexicon theme extraction, not an LLM. The lexicon lives in the `themes` / `theme_keywords` tables (§7), seeded by migration and editable in settings — never a map hard-coded in TypeScript. Seeded examples: waiting/slow/late → `Waiting`; cold/lukewarm → `Cold`; bill/charge/overcharge → `Billing`; taste/bland/salty → `Taste`. Matches are written to `feedback_themes` at submit time so analytics aggregates in Postgres. **Always store and display the original comment verbatim.** Analysis assists management; it never replaces raw feedback.

**Alerts (§27).** Evaluated on write in `POST /api/feedback` + a poll endpoint the dashboard hits every 60s. Thresholds and cooldowns configurable; every alert carries a `dedupe_key` so one live condition is one row (§7). Example: `3 customers rated Service 1/5 in the last 45 minutes.`

---

## 10. EXCEL EXPORT (§39)

`GET /api/export?scope=current|all&from=&to=` → ExcelJS workbook, six sheets, exactly:

1. **Feedback** — every record, one row each, ratings as columns
2. **Guests** — unique guests + aggregates
3. **Ratings Summary** — aggregated metrics per category per day
4. **Issues** — improvement categories + mention counts
5. **Follow-ups** — complaint management pipeline
6. **Daily Summary** — daily KPIs

Frozen header row, bold headers, auto-width, date formatting `dd-MMM-yyyy`. Filename `AIC-Feedback-{from}-to-{to}.xlsx`.
**Export is role-restricted** (OWNER/ADMIN/MANAGER only) and every export writes an `audit_log` row. Phone numbers appear in full **only** in exports by OWNER/ADMIN.

---

## 11. PRIVACY (§45)

- Phone collection was optional always. As of 0018 it is **required to complete the journey**
  (§4). The consent line must therefore not describe it as optional, and anyone reviewing this
  against India's DPDP Act should note that consent for data which is not necessary to deliver
  the service is a different question when the service is withheld without it. Flagged, not
  resolved — that is a decision for the client and their counsel.
- Consent language visible on the contact screen — not buried.
- Phone masked as `XXXXXX3210` everywhere except: guest profile (MANAGER+), follow-up detail (assigned staff), OWNER/ADMIN exports.
- Configurable retention policy in settings (default: retain indefinitely, but the setting and the purge job must exist).
- Every unmask/export action is audit-logged.

---

## 12. PHASE 1 SCOPE BOUNDARY

**Wallet reward is OFF (§17).** Build the config keys (`rewards.enabled`, `rewards.amount`, `rewards.wallet_provider`) and the branch point in the journey, but ship with `enabled: false` and no reward UI. It must be switchable later without touching the feedback journey.

**Memory Print Module is IN Phase 1 (Phase 1b).** Front-camera keepsake photo, printed on the
built-in thermal printer after feedback commits. Full spec in **PHOTO_MODULE.md** — read it
before building anything camera- or printer-related. Three rules govern it absolutely:
feedback commits first; the image never leaves the machine; the keepsake is promised and
delivered unconditionally, never tied to the rating.

Its per-feedback state (`memory_offered`, `memory_printed`, `memory_retries`) is written
**after** the feedback row commits, so it does not travel the service-role submit path. It
gets its own narrow PATCH route and an RLS policy scoped to those three columns — the submit
endpoint's privileges are not a convenience to be reused.

**Not in Phase 1:** LLM sentiment, SMS/WhatsApp sending, POS/bill integration, multi-language, customer-facing app.

---

## 13. WORKING AGREEMENTS FOR CLAUDE CODE

1. Migrations only — never edit the DB by hand. Every schema change is a numbered SQL file in `supabase/migrations/`.
2. Regenerate `types/database.ts` after every migration. No `any`, no untyped Supabase responses.
3. Server Components by default. Add `'use client'` only for actual interactivity.
4. Never hard-code a customer-facing string. If you're about to type one, add it to `app_config` instead.
5. All dates in Asia/Kolkata. Never `new Date()` for business logic — use the `lib/time.ts` helpers.
6. Service role key: server-only, never in a client component, never in `NEXT_PUBLIC_*`.
7. Commit per prompt with a clear message. Don't batch multiple prompts into one commit.
8. After each prompt: state what you built, what you'd flag, and stop. Don't run ahead to the next prompt.
9. When the spec and your instinct disagree, **the spec wins** — surface the disagreement in your summary instead of silently deviating.

---

## 14. THE TEN NON-NEGOTIABLES (§47)

1. Not a generic feedback form — a Customer Experience Intelligence System.
2. The kiosk must make the customer feel: *"You have a voice here. We are listening."*
3. Never manipulate toward a positive rating. Use psychology for agency, permission, validation, low friction, choice and emotional closure — never for score inflation. **This governs the Memory Print Module absolutely: the keepsake is unconditional, never mentioned during rating, and identical for a 1/5 guest and a 5/5 guest.**
4. Preserve the finalized customer-facing language exactly unless changed via the CMS.
5. Everything management may reasonably want to change must be dynamic.
6. Dashboard priority order: **Problems → Trends → Insights → Actions → Raw Data.**
7. Every metric answers: what happened, how significant, improving or worsening, why, what next.
8. The owner understands the state of the café in ~60 seconds.
9. Every submission stays traceable to its guest when a phone number is given.
10. Raw feedback is preserved in full even when analytics categorises or interprets it.
