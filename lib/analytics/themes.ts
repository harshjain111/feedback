import type { Theme } from '@/lib/config.types'

/**
 * Comment theme extraction — CLAUDE.md §9.
 *
 * Phase 1 is keyword/lexicon matching, not an LLM. The lexicon lives in the
 * `themes` / `theme_keywords` tables and is passed in, never hard-coded here:
 * a manager editing the keyword list in settings must change behaviour without
 * a deploy.
 *
 * The extracted matches are an INDEX over the comment, never a replacement for
 * it (§14.10). `feedback.comment` is stored verbatim and is what the admin UI
 * shows; these rows only make the aggregate queries cheap.
 *
 * Prompt 27 builds the aggregation, rendering and backfill on top of this.
 */

export type ThemeMatch = {
  theme_id: string
  mentions: number
}

/** Escape a keyword for use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Build a matcher for one keyword.
 *
 * Word boundaries matter: "late" must not fire on "chocolate", and "bill" must
 * not fire on "billion". Multi-word keywords ("value for money", "no one came")
 * allow flexible whitespace so line breaks and double spaces still match.
 */
function keywordPattern(keyword: string): RegExp {
  const escaped = escapeRegExp(keyword.trim()).replace(/\s+/g, '\\s+')
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu')
}

/**
 * Count keyword hits per theme in a comment.
 *
 * Returns only themes with at least one hit. Mentions are capped per theme at
 * the number of distinct keyword hits so a guest repeating a word ten times
 * cannot outweigh ten guests mentioning it once.
 */
export function extractThemes(comment: string | null | undefined, lexicon: Theme[]): ThemeMatch[] {
  const text = (comment ?? '').trim()
  if (text === '') return []

  const matches: ThemeMatch[] = []

  for (const theme of lexicon) {
    let mentions = 0

    for (const keyword of theme.keywords) {
      if (keyword.trim() === '') continue
      const found = text.match(keywordPattern(keyword))
      if (found) mentions += found.length
    }

    if (mentions > 0) {
      matches.push({ theme_id: theme.theme_id, mentions })
    }
  }

  return matches
}

/**
 * Which themes a comment hits, restricted to one kind.
 *
 * A negative journey's comment should not be credited to positive themes just
 * because it contains the word "clean" in "the table was not clean".
 */
export function extractThemesOfKind(
  comment: string | null | undefined,
  lexicon: Theme[],
  kind: 'negative' | 'positive',
): ThemeMatch[] {
  return extractThemes(
    comment,
    lexicon.filter((theme) => theme.kind === kind),
  )
}
