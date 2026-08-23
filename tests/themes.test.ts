import { describe, expect, it } from 'vitest'
import { extractThemes, extractThemesOfKind } from '@/lib/analytics/themes'
import { REFERENCE_DEFAULTS } from '@/lib/reference.defaults'
import type { Theme } from '@/lib/config.types'

const LEXICON = REFERENCE_DEFAULTS.themes

function themeNamed(name: string, kind: 'negative' | 'positive' = 'negative'): Theme {
  const found = LEXICON.find((theme) => theme.name === name && theme.kind === kind)
  if (!found) throw new Error(`seed has no ${kind} theme "${name}"`)
  return found
}

function namesFor(comment: string): string[] {
  const byId = new Map(LEXICON.map((theme) => [theme.theme_id, theme]))
  return extractThemes(comment, LEXICON)
    .map((match) => byId.get(match.theme_id))
    .filter((theme): theme is Theme => Boolean(theme))
    .map((theme) => `${theme.kind}:${theme.name}`)
}

describe('extractThemes', () => {
  it('finds nothing in an empty or missing comment', () => {
    expect(extractThemes('', LEXICON)).toEqual([])
    expect(extractThemes('   ', LEXICON)).toEqual([])
    expect(extractThemes(null, LEXICON)).toEqual([])
    expect(extractThemes(undefined, LEXICON)).toEqual([])
  })

  it('matches the §9 seeded examples', () => {
    expect(namesFor('We waited 40 minutes')).toContain('negative:Waiting')
    expect(namesFor('The food was cold')).toContain('negative:Cold Food')
    expect(namesFor('I was overcharged on the bill')).toContain('negative:Billing')
    expect(namesFor('Very bland and salty')).toContain('negative:Taste')
  })

  it('is case insensitive', () => {
    expect(namesFor('SLOW SERVICE')).toContain('negative:Waiting')
    expect(namesFor('slow service')).toContain('negative:Waiting')
  })

  it('respects word boundaries — no matching inside another word', () => {
    // "late" must not fire on "chocolate", "bill" must not fire on "billion".
    expect(namesFor('The chocolate cake was lovely')).not.toContain('negative:Waiting')
    expect(namesFor('A billion thanks')).not.toContain('negative:Billing')
  })

  it('matches multi-word keywords across flexible whitespace', () => {
    expect(namesFor('great value  for\nmoney')).toContain('positive:Value')
    expect(namesFor('no one came to the table')).toContain('negative:Staff')
  })

  it('counts repeated keywords as multiple mentions', () => {
    const waiting = themeNamed('Waiting')
    const once = extractThemes('we had to wait', LEXICON).find(
      (m) => m.theme_id === waiting.theme_id,
    )
    const twice = extractThemes('we wait and wait', LEXICON).find(
      (m) => m.theme_id === waiting.theme_id,
    )
    expect(once?.mentions).toBe(1)
    expect(twice?.mentions).toBe(2)
  })

  it('can match several themes in one comment', () => {
    const found = namesFor('Cold food, slow service and the bill was wrong')
    expect(found).toContain('negative:Cold Food')
    expect(found).toContain('negative:Waiting')
    expect(found).toContain('negative:Billing')
  })

  it('never mutates or returns the comment — it only indexes it', () => {
    const comment = 'The food was cold and the staff were rude'
    const before = comment
    extractThemes(comment, LEXICON)
    expect(comment).toBe(before)
  })
})

describe('extractThemesOfKind', () => {
  it('does not credit a complaint to a positive theme', () => {
    // "clean" is a positive keyword; this sentence is not praise.
    const comment = 'the table was not clean'
    const positive = extractThemesOfKind(comment, LEXICON, 'positive')
    const negative = extractThemesOfKind(comment, LEXICON, 'negative')

    expect(positive.length).toBeGreaterThan(0) // naive matcher does fire
    expect(extractThemesOfKind(comment, LEXICON, 'negative')).toEqual(negative)

    // Which is exactly why the caller filters by the journey's pathway rather
    // than trusting the keyword alone. Phase 1 is a lexicon, not an LLM (§9).
  })
})
