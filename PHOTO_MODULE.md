# AIC CXIS — Memory Print Module (Phase 1b)

> A free printed keepsake, given to every guest who completes feedback.
> Purpose: pull in the silent middle. Effect: better sample, better data, and your logo walks
> out the door in someone's pocket.

**Read alongside CLAUDE.md. Everything here is subordinate to CLAUDE.md §14 — in particular
non-negotiable #3: the photo is never leverage for a better rating.**

> **Reconciled against the build, 24 Aug 2026.** This file was drafted from the original PDF,
> which still had the `WOULD YOU LIKE US TO FOLLOW UP?` screen at §11. That screen is cut —
> see CLAUDE.md §4 — so the §7 journey below shows the four-step flow that actually ships.
> Where this file and CLAUDE.md disagree, CLAUDE.md wins; where either disagrees with the
> repo, the repo wins and the doc is the thing that needs fixing.

---

## 0. CONFIRMED HARDWARE

| | |
|---|---|
| Kiosk | 24" FHD portrait all-in-one, floor stand |
| OS | **Windows 11 IoT** |
| CPU / RAM | Intel Core i3 (11th gen) / 8GB RAM / 128GB SSD |
| Printer | Built-in 80mm thermal, **auto-cutter**, ESC/POS over USB |
| Camera | Integrated front camera |
| Print width | **576 dots** @ 203 dpi, **1-bit** (pure black or white — no greyscale) |
| Scanner | 2D barcode (unused in Phase 1 — reserved for wallet/bill linkage later) |

Windows was chosen deliberately over the Android variant: the print agent is plain Node
talking to a USB ESC/POS device, no vendor SDK, no wrapper app, and the printer is
replaceable without a rewrite.

---

## 1. THE THREE INVIOLABLE RULES

**Rule 1 — Feedback commits first.**
`POST /api/feedback` succeeds and returns a `feedbackCode` **before** the photo screen is
allowed to mount. A jammed printer, a revoked camera permission, a dead agent — none of it
can cost you the feedback record. The photo layer must never be able to break the thing it is
attached to.

**Rule 2 — The photo never leaves the machine.**
Browser memory → `127.0.0.1:9100` → printer → buffer zeroed. It never touches Vercel, never
touches Supabase, never crosses the internet, is never written to disk. No upload, no bucket,
no retention policy, no DPDP exposure on biometric-adjacent data. This is not "we delete it
after" — the image has no path off the device. Say so on the screen, plainly.

**Rule 3 — Promised unconditionally, delivered unconditionally.**
The offer appears on the Welcome screen and is honoured for every completed submission
regardless of score. It is **never mentioned on the rating screens, never on the issue screens,
never conditioned on anything.** A guest who rates everything 1/5 gets the same print as one
who rates everything 5/5. Any implementation that ties the keepsake to sentiment is a defect,
not a feature.

---

## 2. ARCHITECTURE

```
Chrome (kiosk mode) — Vercel-hosted app
   │
   │  1. feedback already committed ✓
   │  2. getUserMedia → live preview (mirrored)
   │  3. 5s countdown → capture full-res frame, UNMIRRORED
   │  4. guest reviews: RETRY or KEEP
   │
   │  POST http://127.0.0.1:9100/print   { jpegBase64, caption, dateLabel }
   ▼
Print Agent — Node service, Windows service, kiosk-local only
   │  auto-levels → CLAHE → unsharp → gamma → 512px → Atkinson dither
   │  compose 576-wide 1-bit canvas: logo / photo / caption / footer
   │  ESC/POS raster (GS v 0) → cut
   ▼
80mm thermal printer
   │
   └─→ { ok: true }   buffers zeroed, nothing persisted
```

### localhost from an HTTPS page
Chrome blocks `https://` origins calling `http://127.0.0.1`. Launch Chrome with:
```
--unsafely-treat-insecure-origin-as-secure=http://127.0.0.1:9100
--allow-running-insecure-content
```
Acceptable because the kiosk is locked to a single origin. (Alternatives: a locally-trusted
cert, or serving the app from the agent — both heavier. Take the flag.)

---

## 3. CAPTURE SPEC

- `getUserMedia({ video: { width: 1920, height: 1080, facingMode: 'user' } })`
- Preview is **mirrored** (`transform: scaleX(-1)`) — people expect a mirror.
- **Capture is UNMIRRORED.** Draw to an offscreen canvas without the flip, or text on
  clothing prints backwards.
- Capture from the **full-resolution stream**, never from the downscaled preview element.
- Frame **4:5 portrait**, wide enough for a group of four at a table. Show a subtle frame
  guide in the preview.
- **Screen flash fill light:** during the final 1.5s of the countdown, ramp the page
  background to near-white at full screen brightness. A 24" panel at arm's length is a real
  softbox, and café lighting in the evening is dim and flat. Underexposed input cannot be
  rescued by any amount of processing downstream.
- Countdown: 5s, large numerals, audible tick if speakers exist.
- **Retry cap: 3.** After the third, KEEP is the only option. Prevents one table holding the
  kiosk hostage during the 9pm exit rush.
- Release the camera track the instant the journey ends. The LED going dark matters to people.

---

## 4. IMAGE PIPELINE — the whole product lives here

576 dots across, one bit deep. A raw photo pushed through that is unreadable mud. Order
matters:

| # | Step | Why |
|---|---|---|
| 1 | Crop to 4:5 | Frame consistency |
| 2 | Grayscale, luminance-weighted (0.299/0.587/0.114) | Not a naive channel average |
| 3 | **Auto-levels** — stretch histogram, clip 0.5% each tail | Café lighting is dim and flat |
| 4 | **CLAHE**, clip 2.0, 8×8 tiles | Local contrast. *This is the step that makes faces legible.* |
| 5 | Unsharp mask, radius 1.0, amount 0.6 | Recovers edge definition pre-dither |
| 6 | Gamma ≈ 1.2 | Thermal heads over-deposit; prints run dark |
| 7 | Downscale to 512px wide, Lanczos | Final print size |
| 8 | **Atkinson dither → 1-bit** | See below |

**On dithering:** Floyd–Steinberg is the reflex choice, but it diffuses 100% of the error and
goes grey and muddy on thermal paper. **Atkinson diffuses only 3/4** — highlights blow clean
white, shadows go solid black. The result is punchy and graphic, the classic early-Mac look.
That is the "filter." Not an Instagram overlay: an honest aesthetic choice that makes the
1-bit constraint read as deliberate rather than cheap.

**On the CLAHE numbers — deviation from this section, measured.** "clip 2.0, 8×8 tiles" is
OpenCV's vocabulary: divide the frame into a grid, equalise each cell, interpolate between
them. libvips, which is what sharp calls, has no tile-grid CLAHE — its `hist_local` slides
ONE window of the size you give it. Reading "8×8 tiles" as `window = width/8` therefore
produces a ~120px window on a 960px crop, and a window that large sees almost the same
histogram as the whole frame.

Measured on a real textured image at clip 2, that setting left the buffer **bit-for-bit
identical to CLAHE being switched off**. The step this table calls *the step that makes faces
legible* was not running at all, and every other test still passed.

| sliding window | local contrast | vs no CLAHE |
|---|---|---|
| 120px (`width/8`) | 21.65 | +0.2% — inert |
| 32px | 22.33 | +3% |
| 16px | 24.14 | +12% |
| 8px | 27.83 | +29%, etched and noisy |

So the knob is `clahe.windowPx` — a sliding window in **pixels**, not a tile count —
defaulting to **24**, which measures +12% local contrast on the same image. `clip` stays 2
and must be a whole number: sharp's `maxSlope` is "Expected integer between 0 and 100" and
throws on 2.5.

The intent of this section is unchanged and now actually happens. The literal parameters do
not survive the library. Flagged for approval.

All parameters live in the agent's `config.json` so they can be tuned on-site against the
café's actual evening lighting without a redeploy.

---

## 5. PRINT COMPOSITION

Composed as **one 576-wide 1-bit bitmap** in the agent, sent as a single `GS v 0` raster —
not as separate text and image commands, so alignment is exact and the layout can't drift.

```
        576 dots
┌────────────────────────────┐
│                            │  32px top margin
│      [ AIC LOGO 1-BIT ]    │  pre-dithered asset, max 320w
│                            │
│  ┌──────────────────────┐  │
│  │                      │  │
│  │   DITHERED PHOTO     │  │  512 × 640, centred (32px side margins)
│  │                      │  │
│  │                      │  │
│  └──────────────────────┘  │
│                            │  ← 90px WHITE GAP.
│    caption line here       │     This is the polaroid tell. Do not shrink it.
│                            │
│  All India Café · 24 Aug   │  small, centred
│                            │
└────────────────────────────┘
          [ AUTO CUT ]
```

**Logo:** must be a **hand-prepared 1-bit bitmap asset**, tuned once by a person. Do not
auto-convert the vector at runtime — thin strokes and gradients disappear entirely at 203dpi.
Uploaded via admin settings as a dedicated "thermal logo" slot, separate from the web logo.

**Caption:** rendered as bitmap text from an embedded font, not ESC/POS font codes — keeps it
in the single raster and lets it be styled. Max 2 lines, auto-fit.

---

## 6. AGENT API

`GET /status`
```json
{ "ok": true, "printer": "online", "paper": "ok", "camera": "present", "version": "1.0.3" }
```
Polled by the kiosk on boot and every 5 min. Result is pushed to `kiosks.printer_status` so
the admin dashboard shows a **"Kiosk printer offline"** badge — you find out immediately,
not three days later when someone mentions it.

`POST /print`
```json
{ "jpegBase64": "...", "caption": "...", "dateLabel": "24 Aug 2026", "copies": 1 }
```
→ `{ "ok": true, "ms": 4200 }` or `{ "ok": false, "reason": "OUT_OF_PAPER" }`

Agent constraints: binds **`127.0.0.1` only** (never `0.0.0.0`). No disk writes, ever — no
temp files, no logs containing image data. Buffers explicitly zeroed after print. Single-flight
queue, one job at a time. Runs as a Windows service with auto-restart. Structured logs of
events and errors only — never payloads.

---

## 7. JOURNEY CHANGES

```
[01 WELCOME]  + keepsake offer line, unconditional
      ↓
[RATE] → branch → [ISSUES | LOVED | COMMENT] → [CONTACT]
      ↓
  ✅ POST /api/feedback  ← COMMITS HERE. Rule 1.
      ↓
[MEMORY OFFER]      "Before you go — take a memory with you"
      ↓ TAKE PHOTO / NO THANKS
[PREVIEW + 5s COUNTDOWN + screen flash]
      ↓
[REVIEW]  RETRY (max 3) / KEEP THIS ONE
      ↓
[PRINTING…]  progress + "collect your print below"
      ↓
[05 THANK YOU]  (unchanged, per CLAUDE.md §5)
      ↓ auto-reset
```

**Negative-branch tone.** A guest who waited 40 minutes for cold food does not want a cheerful
"smile!" screen — it reads as papering over the complaint. The photo is still offered, but with
its own copy set (`config.memory.negative_*`), sincere rather than upbeat. Same gift, different
register. See §9.

**Skip is always available and equally weighted.** Not a small grey link.

**Any failure** — no camera permission, agent unreachable, out of paper — routes silently to
the normal thank-you screen. Never show a guest an error about a free gift. Log it, badge it
in admin, move on.

---

## 8. SCHEMA & CONFIG ADDITIONS

*Migration number: `0014`. `0001`–`0013` are applied. The playbook's original `0006` was
written before the core build existed and would collide with `0006_retention_and_rate_limit`.*

```sql
ALTER TABLE kiosks
  ADD COLUMN printer_status text DEFAULT 'unknown',   -- online|offline|out_of_paper|unknown
  ADD COLUMN camera_status  text DEFAULT 'unknown',
  ADD COLUMN agent_version  text,
  ADD COLUMN status_checked_at timestamptz;

ALTER TABLE feedback
  ADD COLUMN memory_offered  boolean DEFAULT false,
  ADD COLUMN memory_printed  boolean DEFAULT false,
  ADD COLUMN memory_retries  smallint DEFAULT 0;
```

**No image column. No storage bucket. Anywhere. Ever.** Only these booleans — enough to
measure uptake, nothing that identifies anyone.

**These three columns get their own PATCH route, not the submit path.** They are written
*after* the feedback row commits (Rule 1), so the write happens in a second request. That
request must not reuse `POST /api/feedback`'s service-role client: an endpoint that can insert
guests and feedback is far too much privilege for setting three booleans, and reaching for it
because it is already there is how a narrow write becomes a wide hole. Build
`PATCH /api/feedback/[id]/memory` with an RLS policy scoped to `memory_offered`,
`memory_printed` and `memory_retries` on that one row, keyed by the `submission_id` the kiosk
already holds. Nothing else about the photo is ever written anywhere.

New `app_config` section `memory`:
```
enabled, auto_disable_on_failure, failure_threshold, schedule_enabled, schedule_windows,
offer_line_welcome, offer_heading, offer_body, take_cta, skip_cta,
countdown_seconds, max_retries, review_heading, retry_cta, keep_cta,
printing_message, collect_message,
negative_offer_heading, negative_offer_body,
caption_line, caption_line_negative, footer_line,
thermal_logo_url,
pipeline: { clahe_clip, gamma, unsharp_amount, dither }
```
Every string CMS-editable, per CLAUDE.md §3.

---

## 8b. THE KILL SWITCH — full spec

The manager must be able to turn the camera and printing off from the dashboard **in one tap,
with no redeploy and no restart**, and the change must reach the kiosk within seconds. Three
independent layers:

**Layer 1 — Master toggle.** `memory.enabled = false` removes the module from the journey
entirely: contact goes straight to thank-you, `/memory` redirects out, the camera is never
requested (**no permission prompt, no camera LED, ever**), and the welcome screen's keepsake
offer line disappears. No trace, no dead button, no "temporarily unavailable" message. A guest
using a disabled kiosk should not be able to tell the feature exists.

**Layer 2 — Auto-disable on failure.** If `auto_disable_on_failure` is on and N consecutive
print attempts fail (`failure_threshold`, default 3), the module self-disables and raises a
dashboard alert. This is the important one: it means a jammed printer at 9pm on a Saturday
stops offering a gift it cannot deliver, without anyone noticing first. Re-enable is manual —
the system never silently switches itself back on.

**Layer 3 — Schedule (optional).** `schedule_windows` lets the module run only during chosen
hours or days — e.g. off during the weekday lunch rush, on for evenings and weekends. Off by
default; useful once you see where the queue actually forms.

**Propagation.** Config is cached 60s server-side (CLAUDE.md §5). Toggling must call
`revalidateTag('config')` immediately, and the kiosk re-reads config at the start of every
journey. Worst case a guest already mid-journey when it flips still sees the offer — acceptable,
and better than pushing state at an idle kiosk. **The kiosk must never cache `memory.enabled`
in client state across journeys.**

**Placement.** The toggle belongs in two places: Settings > Memory, and as a one-tap control on
the device-health badge in the admin header. When the printer is reported offline, the header
badge itself offers "Turn off memory prints" — the manager should not have to go hunting
through settings while the café is full.

Every toggle writes an `audit_log` row with actor, timestamp, and whether it was manual or
automatic.

---

## 9. COPY — DRAFTS FOR APPROVAL

*Seed these; refine in the CMS once you see them on paper.*

**Welcome screen addition**
> `Share your feedback and take home a memory, on us.`

**Memory offer — standard**
> **BEFORE YOU GO — TAKE A MEMORY WITH YOU**
> A little keepsake from your visit today. Our gift, no strings.
> `TAKE A PHOTO →` / `NO THANKS`
> *Your photo prints here and is never saved or stored anywhere.*

**Memory offer — negative branch**
> **WE'D LIKE YOU TO LEAVE WITH SOMETHING GOOD**
> Today didn't go the way it should have, and we're working on it.
> Take a small keepsake with you anyway.
> `TAKE A PHOTO →` / `NO THANKS`

**Review**
> **HAPPY WITH THIS ONE?** — `TAKE ANOTHER` / `PRINT IT →`

**Printing**
> **PRINTING YOUR MEMORY…** / Collect it just below the screen.

**Caption lines — pick one**
1. `Some memories are meant to be carried home.`
2. `Made of good food, good people and a little bit of time.`
3. `Shared tables. Shared stories.`
4. `Every visit leaves something behind. This one's yours.`

**Negative-branch caption**
> `Come back and let us do better.`

**Footer:** `All India Café · {date}` — with `@allindiacafe` on a third line if you want the
handle on every print.

My pick: **#1** as the everyday line. It's the closest to what you described, it earns the
polaroid framing, and it doesn't oversell a thermal print.

---

## 10. OPERATIONAL NOTES

- **Consumables:** ~₹0.40–0.60 per print at 80mm. At 120 prints/day ≈ **₹1,800–2,200/month.**
  Budget it as marketing spend, not overhead — it buys you response rate *and* a branded object
  in a guest's pocket.
- **Thermal paper fades**, faster in Guwahati heat and humidity. Six months to a year on
  standard stock. **Spec BPA-free, top-coated paper** — better archival life, and BPA-free
  matters when you're handing it to families with children.
- **Journey time roughly doubles** — ~50s to ~110s. Accepted. But watch the 9pm exit rush; if
  queuing shows up in practice, a second kiosk at the door beats shortening the experience.
- **Camera lens gets fingerprinted.** Add it to the daily open checklist. A smeared lens
  destroys the print quality and nobody will report it.
- **Paper roll** should be on the same checklist. The dashboard badge is the backstop, not the
  primary control.
- **Signage on the kiosk itself** — a small printed card, "Free photo with your feedback."
  Guests decide whether to stop before they reach the screen.
