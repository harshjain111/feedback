import { describe, expect, it } from 'vitest'
import { assembleConfig } from '@/lib/config.assemble'
import { CONFIG_DEFAULTS } from '@/lib/config.defaults'
import { freshDb, rows } from './db/harness'

/** Flatten CONFIG_DEFAULTS back to the dotted keys the database stores. */
function flatten(): Map<string, unknown> {
  const out = new Map<string, unknown>()
  for (const [section, values] of Object.entries(CONFIG_DEFAULTS)) {
    for (const [leaf, value] of Object.entries(values as Record<string, unknown>)) {
      out.set(`${section}.${leaf}`, value)
    }
  }
  return out
}

describe('config defaults', () => {
  it('are identical to the seed migration — regenerate with pnpm gen:config if this fails', async () => {
    const db = await freshDb()
    const seeded = await rows<{ key: string; value: unknown }>(
      db,
      `select key, value from app_config order by key`,
    )
    await db.close()

    const defaults = flatten()

    const missingFromDefaults = seeded.filter((r) => !defaults.has(r.key)).map((r) => r.key)
    expect(missingFromDefaults, 'seeded keys absent from lib/config.defaults.ts').toEqual([])

    const missingFromSeed = [...defaults.keys()].filter((key) => !seeded.some((r) => r.key === key))
    expect(missingFromSeed, 'default keys absent from the seed migration').toEqual([])

    const drifted = seeded
      .filter((r) => JSON.stringify(defaults.get(r.key)) !== JSON.stringify(r.value))
      .map(
        (r) =>
          `${r.key}: seed=${JSON.stringify(r.value)} default=${JSON.stringify(defaults.get(r.key))}`,
      )
    expect(drifted, 'values drifted between the seed and the compiled defaults').toEqual([])
  })

  it('type the kiosk timings as numbers, not strings', () => {
    expect(typeof CONFIG_DEFAULTS.kiosk.idle_seconds).toBe('number')
    expect(typeof CONFIG_DEFAULTS.kiosk.thanks_seconds).toBe('number')
    expect(CONFIG_DEFAULTS.kiosk.idle_seconds).toBe(90)
    expect(CONFIG_DEFAULTS.kiosk.thanks_seconds).toBe(8)
  })

  it('ship rewards off (§12)', () => {
    expect(CONFIG_DEFAULTS.rewards.enabled).toBe(false)
  })
})

describe('assembleConfig', () => {
  const complete = [...flatten()].map(([key, value]) => ({ key, value }))

  it('returns database values when every key is present', () => {
    const { config, missing, mistyped } = assembleConfig(
      complete.map((row) =>
        row.key === 'welcome.h1' ? { ...row, value: 'EDITED IN THE CMS' } : row,
      ),
    )
    expect(missing).toEqual([])
    expect(mistyped).toEqual([])
    expect(config.welcome.h1).toBe('EDITED IN THE CMS')
    expect(config.rate.sub).toBe(CONFIG_DEFAULTS.rate.sub)
  })

  it('falls back to the seeded default for a missing key, and says which', () => {
    const withHole = complete.filter((row) => row.key !== 'thanks.h1')
    const { config, missing } = assembleConfig(withHole)

    expect(missing).toEqual(['thanks.h1'])
    expect(config.thanks.h1).toBe(CONFIG_DEFAULTS.thanks.h1)
  })

  it('never returns undefined for any key, even given an empty database', () => {
    const { config, missing } = assembleConfig([])
    expect(missing.length).toBe(flatten().size)

    for (const [section, values] of Object.entries(config)) {
      for (const [leaf, value] of Object.entries(values as Record<string, unknown>)) {
        expect(value, `${section}.${leaf} is undefined`).not.toBeUndefined()
      }
    }
  })

  it('rejects a value of the wrong type rather than rendering it', () => {
    const corrupted = complete.map((row) =>
      row.key === 'kiosk.idle_seconds' ? { ...row, value: 'ninety' } : row,
    )
    const { config, mistyped } = assembleConfig(corrupted)

    expect(mistyped).toEqual(['kiosk.idle_seconds (expected number, got string)'])
    expect(config.kiosk.idle_seconds).toBe(90)
  })

  it('accepts null where the default is null (retention_days, wallet_provider)', () => {
    const { config, mistyped } = assembleConfig(complete)
    expect(mistyped).toEqual([])
    expect(config.privacy.retention_days).toBeNull()
    expect(config.rewards.wallet_provider).toBeNull()
  })
})
