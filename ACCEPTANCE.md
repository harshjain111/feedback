# Acceptance checklist — Phase 1

Run against the live Supabase project, commit `9128322` onwards.
Legend: **PASS** · **PARTIAL** · **FAIL** · **N/A**

---

## The ten non-negotiables (§14)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Not a generic feedback form — a CXIS | **PASS** | Kiosk is one of six surfaces; insights, alerts, themes, guest journeys and export all ship. |
| 2 | Kiosk makes the guest feel heard | **PASS** | Negative pathway opens with "THANK YOU FOR TELLING US.", not an apology or a form. |
| 3 | Never manipulate toward a positive rating | **PASS** | Follow-up buttons are equal weight; automated test asserts "complaint", "lodge", "manager" appear nowhere in that copy. |
| 4 | §5 language preserved exactly | **PASS** | `tests/db/0002-seed.test.ts` re-reads §5 on every run and fails on any drift. 41 strings. |
| 5 | Everything management may change is dynamic | **PASS** | 73 config keys + 4 reference tables, all CMS-editable. Only hard-coded guest-facing text is the crash screen. |
| 6 | Dashboard order: Problems → Trends → Insights → Actions → Raw Data | **PASS** | Alerts, KPIs, *What needs attention?*, highlights, snapshot, strengths. |
| 7 | Every metric answers what/how much/direction/why/next | **PASS** | `Comparison` type makes a bare number unrepresentable; insight cards carry evidence + deep link. |
| 8 | Owner understands the café in ~60 seconds | **PARTIAL** | Structure is right and verified with live data, but only one feedback exists — the 60-second test is not meaningful until real traffic. |
| 9 | Submissions traceable to a guest when a phone is given | **PASS** | Verified live: `AIC-000001` created, second visit attaches, aggregates trigger-maintained. |
| 10 | Raw feedback preserved in full | **PASS** | Both comment texts stored verbatim; themes are an index, never a replacement. Export writes full comments. |

---

## Section-by-section

| § | Area | Status | Note |
|---|---|---|---|
| 1 | Tech stack | **PASS** | Next 15, TS strict, Tailwind v4, Supabase, Recharts, ExcelJS, zod, date-fns-tz, pnpm. |
| 2 | Repo structure | **PASS** | Matches, plus `lib/actions/` and `lib/kiosk/`. |
| 3 | Everything dynamic | **PASS** | Verified: CMS edit reached the kiosk with no redeploy. |
| 4 | Kiosk journey | **PASS** | Walked end to end live; branch rules verified including one `1` among high scores. |
| 5 | Locked copy | **PASS** | Verbatim, test-enforced. |
| 6 | Kiosk design constraints | **PASS** | At 1080×1920: no scroll, zoom locked, `user-select:none`, `overscroll:none`, taps 140×184 and 88px. |
| 7 | Database schema | **PASS** | 20 tables, 8 views, 13 triggers, 20 functions live. |
| 8 | Roles | **PASS** | 21 executable RLS cases as the real `authenticated` role. |
| 9 | Analytics engine | **PASS** | 23 metric/comparison tests, 25 insight tests, all thresholds from config. |
| 10 | Excel export | **PASS** | Six sheets, streamed, role-restricted, audit-logged. Verified live. |
| 11 | Privacy | **PASS** | Masking at the query layer, reveal audit-logged, retention purge implemented and tested. |
| 12 | Phase 1 scope | **PASS** | Rewards keys exist, shipped `false`, no reward UI. |
| 33/34 | Time and day analysis | **PASS** | Minimum sample enforced before claiming a pattern. |
| 43 | Kiosk hardening | **PASS** | IndexedDB queue, crash boundary, heartbeat, back-button guard. |

---

## Open items before go-live

These are decisions for the client, not defects.

1. **Grievance officer number is still the seeded placeholder** (`+91 00000 00000`).
   It is a `tel:` link on the thank-you screen — a guest who taps it today
   reaches nobody. Settings → Grievance officer. The page warns while it is unset.
2. **Branding URLs are placeholders** — website and Instagram.
3. **Rotate the Supabase credentials** that were shared in plain text during
   development, including the service-role key.
4. **`CRON_SECRET` must be set in Vercel** or the nightly retention purge
   refuses to run.
5. **Two comment fields, one column.** A negative journey collects both "TELL US
   MORE" and the general comment; §7 gives `feedback` one `comment`. Both are
   stored verbatim, joined by a blank line, so nothing is lost — but they cannot
   be told apart in analytics. Splitting them needs a column and a migration.
6. **The 60-second dashboard test** needs real traffic to be meaningful.

## Known gaps

- **Alert rules for "category dropping suddenly" and "complaint volume
  spiking"** (§27) are configured but not evaluated on write — the insight
  engine surfaces both on the dashboard, but they do not raise a live alert.
  The other three triggers do.
- **Logo upload to Supabase Storage** (§37) accepts a URL rather than providing
  an uploader.
- **Lighthouse** has not been run; bundle sizes were checked instead
  (~2 kB per kiosk screen, 115 kB first load).
