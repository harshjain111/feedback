# AIC Memory Print Agent

Renders a guest's keepsake photo and prints it on the kiosk's 80mm thermal
printer. Runs **on the kiosk PC only** — it is never deployed to Vercel, and
`.vercelignore` keeps this whole directory out of the upload.

Full spec: `../PHOTO_MODULE.md`. Three rules govern everything here.

| | |
|---|---|
| **1. Feedback commits first** | The kiosk only calls this agent after `POST /api/feedback` has returned. A jammed printer can never cost you a feedback record. |
| **2. The photo never leaves the machine** | Browser memory → `127.0.0.1:9100` → printer → buffers zeroed. No disk, no upload, no bucket. Not "deleted afterwards" — there is no path off the device. |
| **3. Unconditional** | Every completed submission gets the same print, whatever the rating. |

---

## What it does

```
POST /print { jpegBase64, caption, dateLabel, copies }
   │
   ├─ pipeline.ts   crop 4:5 → grey → levels → CLAHE → unsharp → gamma → 512px → Atkinson
   ├─ compose.ts    one 576-wide 1-bit bitmap: logo / photo / 90px gap / caption / footer
   ├─ escpos.ts     GS v 0 raster, banded, then feed and partial cut
   └─ printer.ts    → Windows printer share
   │
   └─ buffers zeroed, { ok: true, ms }
```

---

## Install on the kiosk

Node 20+ and pnpm. From the repo root:

```bash
pnpm install
```

Then set up the printer, edit `config.json`, and install the service.

### 1. The printer

The agent writes **raw ESC/POS** to a shared printer. Windows reaches a USB
thermal printer through the spooler, and this avoids the WinUSB driver swap that
`node-usb` needs — that swap also stops the vendor's own utilities working.

1. Install the printer's driver, or use **Generic / Text Only**.
2. **The driver must pass data through unmodified.** If it "helpfully" reformats,
   the raster prints as confetti. Generic / Text Only is the safe choice.
3. Share it: Printer Properties → Sharing → *Share this printer* → `AIC-Thermal`.
4. Check it is writable:

```bash
pnpm --filter @aic/agent print:test fixtures/real-dim.jpg --share "\\localhost\AIC-Thermal"
```

### 2. `config.json`

```jsonc
{
  "pipeline": { /* imaging — see "Tuning" below */ },
  "print": {
    "rasterWidth": 576,              // print head in dots: 80mm at 203dpi
    "share": "\\\\localhost\\AIC-Thermal",
    "font": "",                      // empty = bundled assets/caption.ttf
    "logo": ""                       // empty = print without a logo
  }
}
```

Every value is validated at startup. A typo fails immediately with the field
named, rather than becoming `NaN` and printing a black rectangle at 9pm.

### 3. The service

```bash
pnpm add -D node-windows
node service/install.cjs --origin https://feedback.allindiacafe.in
```

`--origin` must match the kiosk URL **exactly**. The agent refuses every other
origin, so a wrong value here means every print is rejected with `FORBIDDEN`.

A service rather than a Startup shortcut: the kiosk reboots unattended and
nobody will notice a missing tray icon. winsw restarts the process if it dies,
backing off so a genuinely broken printer does not spin the CPU all night.

Remove with `node service/uninstall.cjs`.

### 4. Chrome

Chrome blocks an `https://` page from calling `http://127.0.0.1`. Launch the
kiosk browser with:

```
--unsafely-treat-insecure-origin-as-secure=http://127.0.0.1:9100
--allow-running-insecure-content
--kiosk https://feedback.allindiacafe.in
```

Acceptable because the machine is locked to a single origin. The alternatives —
a locally-trusted certificate, or serving the app from the agent — are both
heavier for the same result.

---

## Tuning the image pipeline

The numbers that matter cannot be chosen from a desk. They depend on what the
café's lighting does at 9pm and how hard this printer's head deposits. Sit in
front of the machine with a paper roll:

```bash
pnpm --filter @aic/agent pipeline:preview photo1.jpg photo2.jpg --out previews
```

Writes greyscale beside the dithered result, and reports **ink coverage** — the
share of dots the head will fire. Below ~15% is washed out, above ~55% is a dark
smear. Either usually means `gamma` or `clahe` needs a nudge rather than the
photo being bad.

| knob | effect |
|---|---|
| `gamma` | Higher = lighter print. Measured on a dim photo: 1.0 → 61% ink, 1.2 → 53%, 1.6 → 41%. Thermal heads over-deposit, which is why the default is above 1. |
| `clahe.windowPx` | **Sliding window in pixels, not a tile count.** Smaller = more local contrast. Measured: 120px is inert, 32px +3%, 16px +12%, 8px +29% but etched. |
| `clahe.clip` | Contrast ceiling. **Whole numbers only** — sharp rejects `2.5`. Higher allows more gain and more amplified noise. |
| `unsharp.amount` | Edge definition before quantisation. Too high promotes sensor noise into speckle, and speckle survives dithering. |
| `dither` | Leave it on `atkinson`. See below. |

### Why Atkinson, and don't change it

Floyd–Steinberg is the reflex choice and it diffuses 100% of the error, which is
mathematically tidy and on thermal paper looks like mud. Atkinson diffuses only
3/4 and drops the rest. Measured on flat fields:

| input | Atkinson prints | Floyd–Steinberg prints |
|---|---|---|
| 64 | **45** | 63 |
| 128 | 128 | 128 |
| 200 | **218** | 201 |

That S-curve about the 128 pivot is what makes highlights blow clean white and
shadows go solid black. It is the product's look, not a preference.

---

## Daily open checklist

- **Wipe the camera lens.** A smeared lens destroys the print and nobody will
  report it — the guest just gets a bad photo and says nothing.
- **Check the paper roll.** The dashboard badge is a backstop, not the primary
  control (see the paper caveat below).

### Paper

Specify **BPA-free, top-coated** stock. Top-coated survives Guwahati heat and
humidity far better — untreated thermal paper fades in months — and BPA-free
matters when you are handing it to families with children.

---

## Endpoints

Both bound to `127.0.0.1` only. Never `0.0.0.0` — a café's network has guests on
it, and a print endpoint reachable from the wifi is a stranger printing whatever
they like on your roll.

### `GET /status`

```json
{ "ok": true, "printer": "online", "paper": "unknown", "camera": "unknown", "version": "1.0.0" }
```

**`paper` is usually `unknown`, and that is honest rather than broken.** Reading
paper level properly needs a `DLE EOT` round trip, which needs bidirectional
communication. A Windows printer share is a spooler *write* endpoint — bytes go
in, nothing comes back. Reporting `ok` when nothing checked would make the admin
badge actively misleading.

Out-of-paper is therefore caught by prints *failing*, and after
`memory.failure_threshold` consecutive failures the module disables itself
(`PHOTO_MODULE.md` §8b layer 2). The design already assumed this. If you later
fit a serial or libusb transport, `escpos.decodeStatus` is written and tested and
will start returning real values with no other change.

**`camera` is always `unknown` from the agent.** It cannot see the camera; only
the browser can, through `getUserMedia`. The kiosk fills that field in from its
own knowledge before writing to `kiosks`. A green badge on a dead camera would
be worse than no badge.

### `POST /print`

```json
{ "jpegBase64": "…", "caption": "…", "dateLabel": "All India Café · 24 Aug 2026", "copies": 1 }
```

→ `{ "ok": true, "ms": 4200 }` or `{ "ok": false, "reason": "OUT_OF_PAPER" }`

Failures answer **200 with `ok: false`**, not a 5xx. The kiosk treats every
non-ok the same way: silently onward to the thank-you screen. A guest never sees
an error message about a free gift (§7).

`copies` is capped at 3, so a bug in the kiosk cannot empty the roll.

---

## What is not verified

`windowsPrinterTransport` is the one part of this agent that hardware has to
prove. Everything else — the pipeline, the composition, the ESC/POS bytes, the
HTTP surface — is asserted by 95 tests on a machine with no printer attached.
The USB write is not, and is marked as such in the source.

When the kiosk arrives, work through `PHOTO_MODULE.md` §52.
