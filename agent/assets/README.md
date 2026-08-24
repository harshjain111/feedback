# Fonts

`caption.ttf` — **Noto Sans** (regular, latin subset), SIL Open Font License 1.1.
Copied from the `@vercel/og` build that ships inside Next, so the agent does not
depend on another package's internals for something it prints.

## Why an embedded font at all

The caption has to look the same on every print. Rendering text through the
system font stack means the kiosk's installed fonts decide the shape of it, and
a Windows 11 IoT box is not guaranteed to have the face you designed against —
it falls back silently and the print quietly changes. Glyph outlines are read
from this file with opentype.js and rasterised, so nothing about the output
depends on the machine.

## Replacing it with the brand face

`memory.thermal_font` in `config.json` points at this file. Drop a `.ttf` or
`.otf` beside it, point the config at it, and run `pnpm print:test` — nothing
else changes. Two things to check before you do:

- **Licence.** Embedding and redistributing a font is a licence question, and
  most commercial faces do not permit it. Noto Sans does; your brand face may
  not.
- **Hinting at 203dpi.** Caption text prints around 22px tall on an 80mm roll.
  Faces with fine strokes or high contrast between thick and thin lose the thin
  ones entirely at that size — the same reason PHOTO_MODULE.md §5 insists the
  logo be a hand-prepared 1-bit bitmap. A plain grotesque survives; a display
  serif usually does not.
