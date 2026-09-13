import 'server-only'

import { cache } from 'react'
import { createAdminClient } from './supabase/admin'
import { allowOfflineSeedFallback, outletCode } from './supabase/env'
import { assembleConfig } from './config.assemble'
import { CONFIG_DEFAULTS } from './config.defaults'
import { REFERENCE_DEFAULTS } from './reference.defaults'
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

/**
 * Process-wide memo for the outlet id.
 *
 * `cache()` alone is not enough and the measurement showed why: it dedupes
 * within ONE React render pass, but `getOutletId` is also called from inside
 * `unstable_cache` callbacks and from route handlers, which run outside that
 * pass. A single dashboard render was firing this same query more than thirty
 * times, and because they all went out at once they queued against each other
 * — each one measured 3.5-4s instead of the ~340ms a lone query costs.
 *
 * A code -> id mapping is immutable for the life of a deployment, so it is
 * memoised as a PROMISE at module scope: concurrent callers share the one
 * in-flight request instead of starting their own.
 */
const outletIdByCode = new Map<string, Promise<string>>()

/** Resolves the outlet this deployment serves. One query per server instance. */
export const getOutletId = cache(async (): Promise<string> => {
  if (allowOfflineSeedFallback()) return 'offline-outlet'

  const code = outletCode()
  const existing = outletIdByCode.get(code)
  if (existing) return existing

  const pending = (async () => {
    const db = createAdminClient()
    const { data, error } = await db.from('outlets').select('outlet_id').eq('code', code).single()

    if (error || !data) {
      throw new Error(
        `No outlet with code "${code}". Has 0002_seed.sql been applied? ${error?.message ?? ''}`,
      )
    }
    return data.outlet_id
  })()

  // A transient failure must not be memoised for the life of the process.
  pending.catch(() => outletIdByCode.delete(code))

  outletIdByCode.set(code, pending)
  return pending
})

/** Name and code of the outlet this deployment serves, for the admin header. */
export const getOutlet = cache(async (): Promise<{ name: string; code: string }> => {
  if (allowOfflineSeedFallback()) {
    return { name: CONFIG_DEFAULTS.branding.name, code: outletCode() }
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('outlets')
    .select('name, code')
    .eq('code', outletCode())
    .single()

  if (error) throw new Error(`Could not load the outlet: ${error.message}`)
  return data
})

// -----------------------------------------------------------------------------
// Config assembly
// -----------------------------------------------------------------------------

async function loadConfig(): Promise<AppConfig> {
  if (allowOfflineSeedFallback()) {
    console.warn('[config] Supabase is not configured; serving seeded defaults (dev only).')
    return CONFIG_DEFAULTS
  }

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

/**
 * Wraps a loader in Next's cross-request cache, building the wrapper ONCE.
 *
 * The wrapper used to be constructed inside the caller on every invocation.
 * That is the kind of thing that looks harmless and is not: a fresh wrapper per
 * call does not reliably hit the entry the previous one wrote, so the 60s
 * window never did much and `app_config` was being re-read dozens of times per
 * page. Building it once, at module scope, is what makes the cache a cache.
 *
 * Every entry carries the same tag, so one `revalidateTag(CONFIG_TAG)` after a
 * CMS save drops all of them together.
 */
export const CONFIG_TAG = 'app-config'

function crossRequest<T>(loader: () => Promise<T>, key: string): () => Promise<T> {
  let wrapped: (() => Promise<T>) | null = null
  return async () => {
    if (!wrapped) {
      const { unstable_cache } = await import('next/cache')
      wrapped = unstable_cache(loader, [key, outletCode()], {
        revalidate: REVALIDATE_SECONDS,
        tags: [CONFIG_TAG],
      })
    }
    return wrapped()
  }
}

const cachedConfig = crossRequest(loadConfig, 'app-config')

/** The whole CMS config, fully typed. Never throws, never returns undefined. */
export const getConfig = cache(async (): Promise<AppConfig> => cachedConfig())

// -----------------------------------------------------------------------------
// Reference data
// -----------------------------------------------------------------------------

async function loadCategories(): Promise<Category[]> {
  if (allowOfflineSeedFallback()) return REFERENCE_DEFAULTS.categories
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
}

async function loadRatingScale(): Promise<RatingFace[]> {
  if (allowOfflineSeedFallback()) return REFERENCE_DEFAULTS.ratingScale
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
}

async function loadIssues(kind: IssueKind): Promise<Issue[]> {
  if (allowOfflineSeedFallback()) {
    return REFERENCE_DEFAULTS.issues.filter((issue) => issue.kind === kind)
  }
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
}

/**
 * The comment-intelligence lexicon (§9), themes with their keywords.
 * Read from the database, never a map in code.
 */
async function loadThemeLexicon(): Promise<Theme[]> {
  if (allowOfflineSeedFallback()) return REFERENCE_DEFAULTS.themes
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
}

export type { AppConfig, Category, Issue, IssueKind, RatingFace, Theme }

/**
 * Reference data, cached across requests like the config it sits beside.
 *
 * Categories, the rating scale, issue chips and the theme lexicon are CMS rows
 * that change when somebody edits them and not otherwise, yet every one of them
 * was being re-read on every render — and each read first re-resolved the
 * outlet id. They share the config tag, so a settings save drops them together.
 */
const cachedCategories = crossRequest(loadCategories, 'categories')
const cachedRatingScale = crossRequest(loadRatingScale, 'rating-scale')
const cachedThemeLexicon = crossRequest(loadThemeLexicon, 'theme-lexicon')

// getIssues takes a kind, so it needs one cache entry per kind rather than one
// entry keyed on whichever kind happened to be asked for first.
const cachedIssuesByKind = new Map<IssueKind, () => Promise<Issue[]>>()
function cachedIssues(kind: IssueKind): () => Promise<Issue[]> {
  let entry = cachedIssuesByKind.get(kind)
  if (!entry) {
    entry = crossRequest(() => loadIssues(kind), `issues-${kind}`)
    cachedIssuesByKind.set(kind, entry)
  }
  return entry
}

export const getCategories = cache(async (): Promise<Category[]> => cachedCategories())
export const getRatingScale = cache(async (): Promise<RatingFace[]> => cachedRatingScale())
export const getIssues = cache(async (kind: IssueKind): Promise<Issue[]> => cachedIssues(kind)())
export const getThemeLexicon = cache(async (): Promise<Theme[]> => cachedThemeLexicon())
