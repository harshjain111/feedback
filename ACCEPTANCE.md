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

---

# Phase 1b — Memory Print Module (Prompt 52)

Acceptance against `PHOTO_MODULE.md`. The three inviolable rules are **proven by
tests** (`tests/memory-module-rules.test.ts`), not asserted — all three failure
modes are silent by design, so none would show up in a click-through. Each of
those tests was verified to fail when the rule is deliberately broken.

## The three rules

| # | Rule | Status | How it is proven |
|---|---|---|---|
| 1 | Feedback commits first | **PASS** | The submit moved to the contact screen. `/memory` mounts only when the draft carries a `feedbackCode`, which exists only after `POST /api/feedback` returned. Verified in a browser: navigating to `/memory` cold redirects to `/thanks` and `getUserMedia` is never called. |
| 2 | The photo never leaves the machine | **PASS** | Image identifiers appear in exactly four files, asserted as an exact list — a fifth fails the build. The only network destination is `http://127.0.0.1:9100`, and every `fetch` in that module is asserted to use it. No API route may contain image data. Neither `sessionStorage` nor `localStorage` is written. No image column and no bucket exists anywhere in the schema. |
| 3 | Promised and delivered unconditionally | **PASS** | Zero mentions of the keepsake on any rating, issue, loved, comment or face-scale screen. Exactly one `sentiment ===` branch in the whole flow, and it selects a caption line. Seed copy is asserted free of "if you", "in return", "because you", "reward", "earn", "qualify". |

## Section by section

| Section | Item | Status | Note |
|---|---|---|---|
| §2 | Agent architecture, loopback only | **PASS** | Verified with `netstat`: `127.0.0.1:9100`, never `0.0.0.0`. The host is not configurable — making it a setting invites someone to set `0.0.0.0` "to test" and leave it. |
| §2 | Chrome launch flags | **DOCUMENTED** | `agent/README.md`. Not verifiable without the kiosk. |
| §3 | Capture unmirrored, full resolution | **PASS (code)** | Reads `videoWidth`/`videoHeight`; there is no `ctx.scale(-1, 1)` anywhere. **Needs the kiosk** — hold text up to the camera. |
| §3 | Preview mirrored | **PASS (code)** | `transform: scaleX(-1)` on the video element only. |
| §3 | Screen flash fill light | **PASS (code)** | Full-bleed, `pointer-events-none` so it cannot swallow SKIP. **Needs the kiosk** to judge brightness. |
| §3 | Retry cap of 3 | **PASS** | At the cap the button is *gone*, not disabled — a greyed-out button invites pressing something that will not respond. |
| §3 | Camera released when the journey ends | **PASS (code)** | On capture and on unmount. **Needs the kiosk** to confirm the LED goes dark. |
| §4 | Pipeline, in order | **PASS** | 28 tests. Ordering forced by materialising the buffer between stages, because sharp reorders internally. |
| §4 | Atkinson, not Floyd–Steinberg | **PASS** | Asserted as a measurement: flat 64 prints at 45, flat 200 at 218, where Floyd–Steinberg tracks its input to within 1 level. |
| §4 | CLAHE | **PASS, with a deviation** | §4's literal "8×8 tiles" is OpenCV vocabulary; libvips slides one window and that reading was a **bit-for-bit no-op**. Now `windowPx`, default 24, measured +12% local contrast. Recorded in `PHOTO_MODULE.md` §4. **Awaiting client sign-off.** |
| §4 | Parameters tunable on site | **PASS** | `agent/config.json`, validated at startup with the field named. |
| §5 | One 576-wide raster | **PASS** | A single `GS v 0`; the printer has no cursor to drift. |
| §5 | 90px polaroid gap | **PASS** | Its own test, counting blank rows. |
| §5 | Bitmap text from an embedded font | **PASS** | opentype.js glyph outlines. Deliberately not SVG `<text>` — that resolved through *this machine's* Georgia during development, which is exactly the trap. |
| §5 | Hand-prepared 1-bit thermal logo | **PASS (mechanism)** | Separate config slot; settings warns that auto-converting a vector fails at 203dpi. **The asset itself does not exist** — prints have no logo until someone makes it. |
| §6 | `GET /status` | **PASS** | Live-tested over HTTP. |
| §6 | `POST /print` | **PASS** | Live-tested: 238KB JPEG in, `{ok:true, ms:218}`, 64,913 bytes of valid ESC/POS out. |
| §6 | Single-flight queue | **PASS** | Released in a `finally`, so a jam is one bad print rather than an evening of them. |
| §6 | No disk writes, no payloads in logs | **PASS** | One test snapshots the working directory either side of a request; another prints with a distinctive caption and asserts it appears nowhere in the log. |
| §6 | Buffers zeroed | **PASS** | In a `finally` on every path. |
| §6 | CORS, kiosk origin only | **PASS** | Literal comparison, no wildcard. A wrong origin 403s and is logged. |
| §6 | Windows service, auto-restart | **DOCUMENTED** | `node-windows`, with backoff. **Not run** — needs Windows and the kiosk. |
| §7 | Journey order | **PASS** | `/contact` → commit → `/memory` → `/thanks`. |
| §7 | Negative-branch register | **PASS** | Verified in a browser: `{1,2,4,5}` and `{5,5,5,4}` produce the two copy sets. |
| §7 | Failure routes silently onward | **PASS** | Every exit goes through one `leave()`. No error state exists in the module to surface. |
| §8 | Schema, no image column | **PASS** | Three booleans. A test walks `information_schema` for anything named like image data or typed `bytea`. |
| §8 | Narrow PATCH route | **PASS** | `anon` holds **zero** table and column privileges on `feedback` and exactly one EXECUTE grant, on a `SECURITY DEFINER` function with a pinned `search_path`. |
| §8b | Layer 1 — master toggle | **PASS** | Verified live: flipped `memory.enabled` false, `/memory` redirected with no client code sent that could request a camera. |
| §8b | Layer 2 — auto-disable | **PARTIAL** | 14 unit tests on the logic. **The evaluator is not wired to a live failure counter** — see gaps. |
| §8b | Layer 3 — schedule | **PASS** | Including windows that wrap past midnight, on the Kolkata clock. |
| §8b | Propagation within seconds | **PASS** | The toggle calls `revalidateTag('config')`. Writing the row directly by SQL instead takes the full 60s cache window plus one stale serve. |
| §8b | One-tap control on the health badge | **PASS** | Not only in settings. |
| §9 | Copy seeded | **PASS** | All of §9, `caption_line` option 1. Registered as authored rather than §5 locked copy, so it can be refined in the CMS. |
| §10 | Paper estimate | **PASS** | 113mm per print, measured from a composed raster. Labelled "estimated, not measured" on the tile. |

## What the hardware still has to prove

Written and unit-tested, but has never met a printer or a camera.

1. **`windowsPrinterTransport`** — the only unverified function in the agent,
   marked as such in the source. The driver must be raw / pass-through
   ("Generic / Text Only") or the spooler reformats the raster into confetti.
2. **Mirroring** — hold text up to the camera and confirm it prints readable.
3. **The image pipeline on real faces.** Prompt 46's checkpoint. The fixtures
   are synthetic: a photo of a real person's face is not something to commit to
   a repo for a module whose central promise is that photos are never stored.
   Run `pnpm pipeline:preview` with 5–6 real dim-light photos before go-live.
4. **Fill light** — is a 24" panel actually enough at 9pm?
5. **Camera LED** goes dark when the journey ends.
6. **Cut position** — the blade sits downstream of the head; confirm it lands
   below the footer, not through it.
7. **Journey time.** §10 estimates ~50s → ~110s. Watch the 9pm exit rush.

## Known gaps

- **Layer 2 has no live failure counter.** `memorySwitch()` takes
  `consecutiveFailures` and is fully tested, but nothing counts consecutive
  print failures and feeds it in, so **the module will not actually
  self-disable**. This needs the agent's failure reasons persisted per kiosk. It
  is the one piece of §8b that is logic-complete but not operational.
- **No insight card for a sharp uptake drop.** The uptake tile is on the
  dashboard; the automatic "this usually means the printer is failing silently"
  insight is not built.
- **`paper` is `unknown` in `/status`**, by necessity — a spooler share is
  write-only, so `DLE EOT` cannot round-trip. `decodeStatus` is written and
  tested and starts returning real values the moment a serial or libusb
  transport exists.
- **The thermal logo asset does not exist.**
- **Visual verification was not possible in the final session.** The browser
  pane stopped compositing (`visibilityState: "hidden"`, `requestAnimationFrame`
  never fires), so React 19 never reveals streamed content. Prompts 45–49 were
  verified in a browser; 50–52 are covered by tests and code review only.
