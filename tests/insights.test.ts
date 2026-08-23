import { describe, expect, it } from 'vitest'
import { compare } from '@/lib/analytics/comparison'
import {
  categoryDropInsights,
  categoryStrongInsights,
  generateInsights,
  issueSpikeInsights,
  lowRatingClusterInsights,
  themeEmergingInsights,
  type GeneratorContext,
  type LowRatingCluster,
} from '@/lib/analytics/insight-generators'
import { insightHref, rankInsights } from '@/lib/analytics/insights'
import { CONFIG_DEFAULTS } from '@/lib/config.defaults'
import type { CategoryPerformance, IssueCount, ThemeCount } from '@/lib/queries/types'

const CONTEXT: GeneratorContext = {
  thresholds: CONFIG_DEFAULTS.thresholds,
  from: '2026-08-17',
  to: '2026-08-23',
  periodLabel: 'vs previous 7 days',
}

function category(over: Partial<CategoryPerformance> = {}): CategoryPerformance {
  return {
    categoryId: 'cat-service',
    name: 'SERVICE',
    icon: 'concierge-bell',
    score: compare(3.2, 4.1, 'vs previous 7 days'),
    ratingCount: 40,
    negativeCount: 12,
    status: 'attention',
    ...over,
  }
}

function issue(over: Partial<IssueCount> = {}): IssueCount {
  return {
    issueId: 'issue-waiting',
    name: 'Waiting Time',
    kind: 'negative',
    mentions: compare(23, 9, 'vs previous 7 days'),
    ...over,
  }
}

function theme(over: Partial<ThemeCount> = {}): ThemeCount {
  return {
    themeId: 'theme-cold',
    name: 'Cold Food',
    kind: 'negative',
    feedbackCount: 9,
    mentions: compare(11, 4, 'vs previous 7 days'),
    ...over,
  }
}

const cluster = (over: Partial<LowRatingCluster> = {}): LowRatingCluster => ({
  categoryId: 'cat-service',
  categoryName: 'SERVICE',
  count: 4,
  followUpCount: 2,
  ...over,
})

describe('CATEGORY_DROP', () => {
  it('fires when a category falls past the configured percentage', () => {
    const [insight] = categoryDropInsights([category()], CONTEXT)
    expect(insight).toBeDefined()
    expect(insight?.type).toBe('CATEGORY_DROP')
    expect(insight?.title).toContain('SERVICE is down')
    expect(insight?.metric.value).toBe(3.2)
  })

  it('is critical below the attention threshold and only a warning above it', () => {
    const belowThreshold = categoryDropInsights([category({ score: compare(3.2, 4.1) })], CONTEXT)
    const stillHealthy = categoryDropInsights(
      [category({ score: compare(4.2, 4.9), status: 'watch' })],
      CONTEXT,
    )
    expect(belowThreshold[0]?.severity).toBe('critical')
    expect(stillHealthy[0]?.severity).toBe('warning')
  })

  it('stays silent below the minimum sample size', () => {
    // A 22% drop across three ratings is noise, not a finding.
    expect(categoryDropInsights([category({ ratingCount: 3 })], CONTEXT)).toEqual([])
  })

  it('stays silent for a small movement, and for a rise', () => {
    expect(categoryDropInsights([category({ score: compare(4.05, 4.1) })], CONTEXT)).toEqual([])
    expect(categoryDropInsights([category({ score: compare(4.6, 4.1) })], CONTEXT)).toEqual([])
  })

  it('stays silent with no previous period to compare against', () => {
    expect(categoryDropInsights([category({ score: compare(3.2, null) })], CONTEXT)).toEqual([])
  })

  it('names the leading issue as the "why"', () => {
    const [insight] = categoryDropInsights([category()], CONTEXT, [issue()])
    expect(insight?.evidence).toContain('Waiting Time')
    expect(insight?.evidence).toContain('23 mentions')
  })

  it('deep-links to the negative feedback for that category in this window', () => {
    const [insight] = categoryDropInsights([category()], CONTEXT)
    expect(insightHref(insight!.filter)).toBe(
      '/admin/feedback?range=custom&from=2026-08-17&to=2026-08-23&categoryId=cat-service&ratingBand=negative',
    )
  })
})

describe('CATEGORY_STRONG', () => {
  it('fires only when above the strong threshold AND rising', () => {
    const rising = categoryStrongInsights(
      [category({ name: 'HOSPITALITY', score: compare(4.8, 4.5), status: 'strong' })],
      CONTEXT,
    )
    expect(rising[0]?.severity).toBe('positive')

    const flat = categoryStrongInsights(
      [category({ score: compare(4.8, 4.8), status: 'strong' })],
      CONTEXT,
    )
    expect(flat).toEqual([])

    const risingButOrdinary = categoryStrongInsights(
      [category({ score: compare(4.0, 3.6) })],
      CONTEXT,
    )
    expect(risingButOrdinary).toEqual([])
  })
})

describe('ISSUE_SPIKE', () => {
  it('fires on a rise past the configured percentage', () => {
    const [insight] = issueSpikeInsights([issue()], CONTEXT)
    expect(insight?.type).toBe('ISSUE_SPIKE')
    expect(insight?.evidence).toContain('23 mentions')
  })

  it('treats a rise from no baseline as a spike, without inventing a percentage', () => {
    const [insight] = issueSpikeInsights([issue({ mentions: compare(8, 0) })], CONTEXT)
    expect(insight).toBeDefined()
    expect(insight?.metric.deltaPct).toBeNull()
    expect(insight?.evidence).toContain('up from none')
  })

  it('ignores a large percentage on a tiny count', () => {
    // 1 -> 3 is +200% and means nothing.
    expect(issueSpikeInsights([issue({ mentions: compare(3, 1) })], CONTEXT)).toEqual([])
  })

  it('ignores a fall', () => {
    expect(issueSpikeInsights([issue({ mentions: compare(9, 23) })], CONTEXT)).toEqual([])
  })
})

describe('LOW_RATING_CLUSTER', () => {
  it('fires at the configured count and is always critical', () => {
    const [insight] = lowRatingClusterInsights([cluster()], CONTEXT)
    expect(insight?.severity).toBe('critical')
    expect(insight?.title).toContain('4 guests rated SERVICE 1 or 2')
    expect(insight?.evidence).toContain('2 guests asked to be contacted')
  })

  it('says so when nobody asked to be contacted', () => {
    const [insight] = lowRatingClusterInsights([cluster({ followUpCount: 0 })], CONTEXT)
    expect(insight?.evidence).toContain('nobody is chasing this')
  })

  it('stays silent below the configured count', () => {
    expect(lowRatingClusterInsights([cluster({ count: 2 })], CONTEXT)).toEqual([])
  })
})

describe('THEME_EMERGING', () => {
  it('fires on a rising negative theme as a warning', () => {
    const [insight] = themeEmergingInsights([theme()], CONTEXT)
    expect(insight?.severity).toBe('warning')
    expect(insight?.title).toContain('Cold Food')
    expect(insight?.evidence).toBe('11 mentions across 9 comments.')
  })

  it('reads a rising positive theme as good news', () => {
    const [insight] = themeEmergingInsights(
      [theme({ themeId: 't2', name: 'Warm Service', kind: 'positive' })],
      CONTEXT,
    )
    expect(insight?.severity).toBe('positive')
  })

  it('stays silent below the minimum sample size', () => {
    expect(themeEmergingInsights([theme({ mentions: compare(3, 0) })], CONTEXT)).toEqual([])
  })
})

describe('every insight answers the five §9 questions', () => {
  const all = generateInsights(
    {
      categories: [
        category(),
        category({ categoryId: 'c2', name: 'HOSPITALITY', score: compare(4.8, 4.5) }),
      ],
      issues: [issue()],
      themes: [theme()],
      clusters: [cluster()],
    },
    CONTEXT,
  )

  it('produces one of each type from a realistic period', () => {
    expect(all.map((insight) => insight.type).sort()).toEqual([
      'CATEGORY_DROP',
      'CATEGORY_STRONG',
      'ISSUE_SPIKE',
      'LOW_RATING_CLUSTER',
      'THEME_EMERGING',
    ])
  })

  it('gives every card a title, a comparison, evidence and a deep link', () => {
    for (const insight of all) {
      expect(insight.title, insight.id).not.toBe('')
      expect(insight.metric, insight.id).toBeDefined()
      expect(insight.metric.label, insight.id).not.toBe('')
      expect(insight.evidence, insight.id).not.toBe('')
      expect(insightHref(insight.filter), insight.id).toContain('/admin/feedback?')
    }
  })

  it('carries the period into every deep link', () => {
    for (const insight of all) {
      expect(insightHref(insight.filter), insight.id).toContain('from=2026-08-17')
    }
  })
})

describe('ranking', () => {
  it('puts a live cluster above a big percentage drop on a quiet category', () => {
    const ranked = rankInsights(
      generateInsights(
        {
          categories: [category()],
          issues: [],
          themes: [],
          clusters: [cluster()],
        },
        CONTEXT,
      ),
    )
    expect(ranked[0]?.type).toBe('LOW_RATING_CLUSTER')
    expect(ranked[1]?.type).toBe('CATEGORY_DROP')
  })

  it('caps the board at the requested size', () => {
    const many = generateInsights(
      {
        categories: [
          category(),
          category({ categoryId: 'c2', name: 'FOOD' }),
          category({ categoryId: 'c3', name: 'AMBIENCE' }),
        ],
        issues: [issue(), issue({ issueId: 'i2', name: 'Billing' })],
        themes: [theme()],
        clusters: [cluster(), cluster({ categoryId: 'c2', categoryName: 'FOOD' })],
      },
      CONTEXT,
    )
    expect(many.length).toBeGreaterThan(3)
    expect(rankInsights(many, 3)).toHaveLength(3)
  })
})

describe('thresholds are configuration, not constants', () => {
  it('changes what fires when the config changes', () => {
    const strict: GeneratorContext = {
      ...CONTEXT,
      thresholds: { ...CONTEXT.thresholds, category_drop_pct: 50 },
    }
    // The same 22% drop fires under the default and not under a 50% threshold.
    expect(categoryDropInsights([category()], CONTEXT)).toHaveLength(1)
    expect(categoryDropInsights([category()], strict)).toHaveLength(0)
  })

  it('respects a changed cluster count', () => {
    const relaxed: GeneratorContext = {
      ...CONTEXT,
      thresholds: { ...CONTEXT.thresholds, low_rating_cluster_count: 5 },
    }
    expect(lowRatingClusterInsights([cluster({ count: 4 })], relaxed)).toEqual([])
  })
})
