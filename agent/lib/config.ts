import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/**
 * The agent's tuning file.
 *
 * Every imaging parameter lives in config.json rather than in code, because the
 * numbers that matter here cannot be chosen from a desk: they depend on what the
 * café's lighting actually does at 9pm, and on how hard this particular printer
 * head deposits. Somebody will sit in front of the machine with a paper roll and
 * turn these dials, and they must be able to do it without a rebuild
 * (PHOTO_MODULE.md §4).
 *
 * Parsed and validated rather than cast. A typo'd number in a hand-edited JSON
 * file should fail at startup with a message naming the field, not silently
 * become NaN and print a black rectangle.
 */

export type DitherName = 'atkinson' | 'floyd-steinberg'

export type PipelineConfig = {
  aspect: { w: number; h: number }
  autoLevels: { enabled: boolean; clipLowPct: number; clipHighPct: number }
  /**
   * `windowPx` is the sliding-window SIZE IN PIXELS, not a tile count.
   * See the note in parseConfig — libvips does not do OpenCV's tile grid.
   */
  clahe: { enabled: boolean; windowPx: number; clip: number }
  unsharp: { enabled: boolean; radius: number; amount: number }
  gamma: number
  output: { width: number; kernel: 'lanczos3' | 'lanczos2' | 'cubic' | 'mitchell' }
  dither: DitherName
}

export type AgentConfig = {
  pipeline: PipelineConfig
  print: { rasterWidth: number }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(`config.json: ${message}`)
    this.name = 'ConfigError'
  }
}

function obj(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConfigError(`${path} must be an object`)
  }
  return value as Record<string, unknown>
}

function num(source: Record<string, unknown>, key: string, path: string, min: number, max: number) {
  const value = source[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ConfigError(`${path}.${key} must be a finite number, got ${JSON.stringify(value)}`)
  }
  if (value < min || value > max) {
    throw new ConfigError(`${path}.${key} must be between ${min} and ${max}, got ${value}`)
  }
  return value
}

function int(source: Record<string, unknown>, key: string, path: string, min: number, max: number) {
  const value = num(source, key, path, min, max)
  if (!Number.isInteger(value)) {
    throw new ConfigError(`${path}.${key} must be a whole number, got ${value}`)
  }
  return value
}

function bool(source: Record<string, unknown>, key: string, path: string) {
  const value = source[key]
  if (typeof value !== 'boolean') {
    throw new ConfigError(`${path}.${key} must be true or false, got ${JSON.stringify(value)}`)
  }
  return value
}

function oneOf<T extends string>(
  source: Record<string, unknown>,
  key: string,
  path: string,
  allowed: readonly T[],
): T {
  const value = source[key]
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ConfigError(`${path}.${key} must be one of ${allowed.join(' | ')}, got ${String(value)}`)
  }
  return value as T
}

export function parseConfig(raw: unknown): AgentConfig {
  const root = obj(raw, 'root')
  const p = obj(root['pipeline'], 'pipeline')

  const aspect = obj(p['aspect'], 'pipeline.aspect')
  const autoLevels = obj(p['autoLevels'], 'pipeline.autoLevels')
  const clahe = obj(p['clahe'], 'pipeline.clahe')
  const unsharp = obj(p['unsharp'], 'pipeline.unsharp')
  const output = obj(p['output'], 'pipeline.output')

  const clipLowPct = num(autoLevels, 'clipLowPct', 'pipeline.autoLevels', 0, 20)
  const clipHighPct = num(autoLevels, 'clipHighPct', 'pipeline.autoLevels', 0, 20)
  if (clipLowPct + clipHighPct >= 100) {
    throw new ConfigError('pipeline.autoLevels clips must total less than 100%')
  }

  const pipeline: PipelineConfig = {
    aspect: {
      w: num(aspect, 'w', 'pipeline.aspect', 1, 100),
      h: num(aspect, 'h', 'pipeline.aspect', 1, 100),
    },
    autoLevels: {
      enabled: bool(autoLevels, 'enabled', 'pipeline.autoLevels'),
      clipLowPct,
      clipHighPct,
    },
    clahe: {
      enabled: bool(clahe, 'enabled', 'pipeline.clahe'),
      /*
       * PIXELS, and small ones. §4 says "CLAHE, clip 2.0, 8×8 tiles", which is
       * OpenCV's vocabulary: divide the frame into an 8×8 grid, equalise each
       * cell, interpolate between them. libvips — which is what sharp calls —
       * has no tile-grid CLAHE. Its hist_local slides ONE window of the size
       * you give it across the image.
       *
       * Reading "8×8 tiles" as window = width/8 therefore produces a ~120px
       * window on a 960px crop, and a window that large sees almost the same
       * histogram as the whole frame. Measured on a real textured image, that
       * setting moved local contrast by 0.2% and, at clip 2, left the buffer
       * BIT-FOR-BIT IDENTICAL. The step §4 calls "the step that makes faces
       * legible" was not running at all.
       *
       *   window 120px  local contrast 21.65  (+0.2%, inert)
       *   window  32px                 22.33  (+3%)
       *   window  16px                 24.14  (+12%)
       *   window   8px                 27.83  (+29%, etched and noisy)
       *
       * So the knob is the window in pixels. 24 is deliberately mid-range: it
       * does real work without the haloed, over-etched look that sets in below
       * ~12px, which dithering then exaggerates rather than hides.
       */
      windowPx: int(clahe, 'windowPx', 'pipeline.clahe', 4, 256),
      /*
       * INTEGER, not a float. sharp's maxSlope is "Expected integer between 0
       * and 100" and throws on 2.5 — which validated fine here until this was
       * an int, and then crashed inside the print request. Exactly the failure
       * this file exists to catch: someone tuning at 9pm with a paper roll
       * should get a named field at startup, not a dead agent mid-journey.
       *
       * Floored at 1 rather than sharp's 0: 0 removes the contrast limit
       * altogether, which on a dim photo amplifies sensor noise into confetti,
       * and confetti survives dithering all too well.
       */
      clip: int(clahe, 'clip', 'pipeline.clahe', 1, 100),
    },
    unsharp: {
      enabled: bool(unsharp, 'enabled', 'pipeline.unsharp'),
      radius: num(unsharp, 'radius', 'pipeline.unsharp', 0.3, 10),
      amount: num(unsharp, 'amount', 'pipeline.unsharp', 0, 5),
    },
    // Below 1 would darken, and a thermal print is already too dark.
    gamma: num(p, 'gamma', 'pipeline', 1, 3),
    output: {
      width: int(output, 'width', 'pipeline.output', 64, 576),
      kernel: oneOf(output, 'kernel', 'pipeline.output', [
        'lanczos3',
        'lanczos2',
        'cubic',
        'mitchell',
      ] as const),
    },
    dither: oneOf(p, 'dither', 'pipeline', ['atkinson', 'floyd-steinberg'] as const),
  }

  const print = obj(root['print'], 'print')

  return {
    pipeline,
    print: { rasterWidth: int(print, 'rasterWidth', 'print', 64, 1024) },
  }
}

const DEFAULT_PATH = fileURLToPath(new URL('../config.json', import.meta.url))

export async function loadConfig(path: string = DEFAULT_PATH): Promise<AgentConfig> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (cause) {
    throw new ConfigError(`could not be read at ${path}: ${(cause as Error).message}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (cause) {
    throw new ConfigError(`is not valid JSON: ${(cause as Error).message}`)
  }

  return parseConfig(parsed)
}
