import { CONFIG_DEFAULTS } from './config.defaults'
import type { AppConfig } from './config.types'

export type ConfigRow = { key: string; value: unknown }

export type AssembleResult = {
  config: AppConfig
  missing: string[]
  mistyped: string[]
}

/**
 * Overlay app_config rows onto the compiled-in defaults.
 *
 * Walks the DEFAULTS structure rather than the rows, so a key that is missing
 * or the wrong type falls back instead of rendering `undefined` at a guest. A
 * kiosk screen with a blank headline is worse than a slightly stale one.
 *
 * Pure and free of server-only imports so it can be unit-tested directly.
 */
export function assembleConfig(rows: ConfigRow[]): AssembleResult {
  const byKey = new Map<string, unknown>(rows.map((r) => [r.key, r.value]))
  const missing: string[] = []
  const mistyped: string[] = []
  const result: Record<string, Record<string, unknown>> = {}

  for (const [section, defaults] of Object.entries(CONFIG_DEFAULTS)) {
    const out: Record<string, unknown> = {}

    for (const [leaf, fallback] of Object.entries(defaults as Record<string, unknown>)) {
      const key = `${section}.${leaf}`

      if (!byKey.has(key)) {
        missing.push(key)
        out[leaf] = fallback
        continue
      }

      const value = byKey.get(key)

      // A null default (retention_days, wallet_provider) means "unset is
      // meaningful", so a null or a scalar is accepted there.
      const typesAgree =
        fallback === null
          ? value === null || typeof value !== 'object'
          : typeof value === typeof fallback

      if (!typesAgree) {
        mistyped.push(`${key} (expected ${typeof fallback}, got ${typeof value})`)
        out[leaf] = fallback
        continue
      }

      out[leaf] = value
    }

    result[section] = out
  }

  return { config: result as unknown as AppConfig, missing, mistyped }
}
