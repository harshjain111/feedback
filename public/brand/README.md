# Brand assets

| File | What it is |
|---|---|
| `logo.webp` | **All India Café** plaque, for the kiosk header and the loading screen. Rasterised from the client's vertical-setup PDF at 6×, trimmed, lossless WebP. Transparent corner cut-outs so the ivory ground shows through them. Wired via `branding.logo_url` — swap it in Settings, no redeploy. |
| `vibrnd-logo.png` | **Vibrnd** lockup, white on transparent, 1400×520. Extracted from the supplied JPEG by using luminance as the alpha channel, which keeps the sparkle and the V's edges soft — a hard threshold stair-steps them. Source of the PWA icons. |

## Regenerating the PWA icons

```bash
node scripts/generate-pwa-icons.mjs                 # uses vibrnd-logo.png
node scripts/generate-pwa-icons.mjs path/to/new.png # or any other mark
```

Writes `public/icons/` — 192, 512, a separately laid out maskable 512, and the
Apple touch icon.

## Two things worth knowing before replacing anything

**The thermal logo is not one of these.** `agent/assets/logo-thermal.png` is a
1-bit line-art rendering for the printer, and it is inverted on purpose: the
plaque's orange field prints as paper and the white lettering as ink, which is
17% coverage instead of the 80% a filled block would cost in heat and paper. A
straight conversion of `logo.webp` is legible and prints as a slow black slab.

**Maskable is a separate render, not the same file relabelled.** Android crops
the corners off a maskable icon; reusing the square one would slice the
wordmark. The generator lays it out inside the safe circle.
