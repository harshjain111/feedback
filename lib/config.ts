import 'server-only'

import { cache } from 'react'
import { createAdminClient } from './supabase/admin'
import { outletCode } from './supabase/env'
import { assembleConfig } from './config.assemble'
import { CONFIG_DEFAULTS } from './config.defaults'
import {
  isFaceKey,
  type AppConfig,
  type Category,
  type Issue,
  type IssueKind,
  type RatingFace,
  type Theme,
} from './config.types'

/**
 * CMS config loader — CLAUDE.md §3.
 *
 * Why the service-role client: §7 gives the anon role zero read access, config
 * tables included ("no anon read. Ever."). The kiosk still has to render its
 * copy, and it does so from a Server Component — so the read happens here, on
 * the server, with a key that never reaches the browser. `server-only` above
 * makes importing this from a client component a build error.
 *
 * Caching: React `cache()` dedupes within a single render pass. Cross-request
 * caching with a 60s window is layered on top via `unstable_cache` in
 * getConfig() so a CMS save (Prompt 35) shows up on the kiosk within a minute
 * without a redeploy.
 */

const REVALIDATE_SECONDS = 60

/** Resolves the outlet this deployment serves. Cached for the request. */
export const getOutletId = cache(async (): Promise<string> => {
  const db = createAdminClient()
  const { data, error } = await db
    .from('outlets')
    .select('outlet_id')
    .eq('code', outletCode())
    .single()

  if (error || !data) {
    throw new Error(
      `No outlet with code "${outletCode()}". Has 0002_seed.sql been applied? ${error?.message ?? ''}`,
    )
  }
  return data.outlet_id
})

// -----------------------------------------------------------------------------
// Config assembly
// -----------------------------------------------------------------------------

async function loadConfig(): Promise<AppConfig> {
  const db = createAdminClient()
  const outletId = await getOutletId()

  const { data, error } = await db.from('app_config').select('key, value').eq('outlet_id', outletId)

  if (error) {
    // A database blip must not take the kiosk down: it renders seeded copy.
    console.error('[config] load failed, falling back to seeded defaults:', error.message)
    return CONFIG_DEFAULTS
  }

  const { config, missing, mistyped } = assembleConfig(data ?? [])

  if (missing.length > 0) {
    console.warn(
      `[config] ${missing.length} key(s) missing, using seeded defaults: ${missing.join(', ')}`,
    )
  }
  if (mistyped.length > 0) {
    console.warn(`[config] ${mistyped.length} key(s) had the wrong type: ${mistyped.join(', ')}`)
  }

  return config
}

/** The whole CMS config, fully typed. Never throws, never returns undefined. */
export const getConfig = cache(async (): Promise<AppConfig> => {
  const { unstable_cache } = await import('next/cache')
  const cached = unstable_cache(loadConfig, ['app-config', outletCode()], {
    revalidate: REVALIDATE_SECONDS,
    tags: ['app-config'],
  })
  return cached()
})

// -----------------------------------------------------------------------------
// Reference data
// -----------------------------------------------------------------------------

export const getCategories = cache(async (): Promise<Category[]> => {
  const db = createAdminClient()
  const outletId = await getOutletId()

  const { data, error } = await db
    .from('categories')
    .select('category_id, name, question, icon, display_order')
    .eq('outlet_id', outletId)
    .eq('active', true)
    .order('display_order')

  if (error) throw new Error(`Could not load categories: ${error.message}`)
  return data ?? []
})

export const getRatingScale = cache(async (): Promise<RatingFace[]> => {
  const db = createAdminClient()
  const outletId = await getOutletId()

  const { data, error } = await db
    .from('rating_scale')
    .select('scale_id, value, face_key, label, colour')
    .eq('outlet_id', outletId)
    .eq('active', true)
    .order('value')

  if (error) throw new Error(`Could not load the rating scale: ${error.message}`)

  return (data ?? []).map((row) => {
    if (!isFaceKey(row.face_key)) {
      // The CHECK constraint makes this unreachable; if it ever fires, the
      // migration and the component set have drifted apart.
      throw new Error(`Unknown face_key "${row.face_key}" on rating_scale value ${row.value}`)
    }
    return { ...row, face_key: row.face_key }
  })
})

export const getIssues = cache(async (kind: IssueKind): Promise<Issue[]> => {
  const db = createAdminClient()
  const outletId = await getOutletId()

  const { data, error } = await db
    .from('issues')
    .select('issue_id, name, icon, kind, display_order')
    .eq('outlet_id', outletId)
    .eq('kind', kind)
    .eq('active', true)
    .order('display_order')

  if (error) throw new Error(`Could not load ${kind} issues: ${error.message}`)
  return (data ?? []).map((row) => ({ ...row, kind }))
})

/**
 * The comment-intelligence lexicon (§9), themes with their keywords.
 * Read from the database, never a map in code.
 */
export const getThemeLexicon = cache(async (): Promise<Theme[]> => {
  const db = createAdminClient()
  const outletId = await getOutletId()

  const { data, error } = await db
    .from('themes')
    .select('theme_id, name, kind, display_order, theme_keywords(keyword, active)')
    .eq('outlet_id', outletId)
    .eq('active', true)
    .order('display_order')

  if (error) throw new Error(`Could not load the theme lexicon: ${error.message}`)

  return (data ?? []).map((row) => ({
    theme_id: row.theme_id,
    name: row.name,
    kind: row.kind as IssueKind,
    display_order: row.display_order,
    keywords: (row.theme_keywords ?? [])
      .filter((k: { active: boolean }) => k.active)
      .map((k: { keyword: string }) => k.keyword),
  }))
})

export type { AppConfig, Category, Issue, IssueKind, RatingFace, Theme }
