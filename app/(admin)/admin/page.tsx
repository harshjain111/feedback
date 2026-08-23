import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { AlertBanner } from '@/components/admin/AlertBanner'
import { ExportButton } from '@/components/admin/ExportButton'
import { HighlightCard } from '@/components/admin/HighlightCard'
import { InsightCard, InsightsEmpty } from '@/components/admin/InsightCard'
import { IssueBars } from '@/components/admin/IssueBars'
import { KioskStatus } from '@/components/admin/KioskStatus'
import { KpiCard } from '@/components/admin/KpiCard'
import { Panel } from '@/components/admin/Panel'
import { RatingDonut } from '@/components/admin/RatingDonut'
import { RecentFeedback } from '@/components/admin/RecentFeedback'
import { SectionHeading } from '@/components/admin/SectionHeading'
import { SnapshotStrip } from '@/components/admin/SnapshotStrip'
import { TrendChart } from '@/components/admin/TrendChart'
import { insightHref } from '@/lib/analytics/insights'
import { cn } from '@/lib/cn'
import { requireUser } from '@/lib/auth'
import { getConfig, getRatingScale } from '@/lib/config'
import { can } from '@/lib/permissions'
import {
  getFeedbackList,
  getKpis,
  getRatingDistribution,
  getTodaySnapshot,
  getTopIssues,
  getTrend,
} from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'
import { getInsights } from '@/lib/queries/insights'
import { parseRange, rangeToParams } from '@/lib/range'

/**
 * Today at a Glance — CLAUDE.md §32.
 *
 * The order on this page IS the product (§14.6): Problems → Trends → Insights →
 * Actions → Raw Data. The test it has to pass is that an owner opening it cold
 * understands the state of the café in about sixty seconds, so every block has
 * to earn its place against that. Anything that would take longer to interpret
 * than it saves belongs on the analytics page instead.
 */
export default async function AdminTodayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser('/admin')

  // STAFF have no dashboard (§8); their work is the follow-up they were given.
  if (!can(user, 'view:dashboard')) redirect('/admin/feedback')

  const params = await searchParams
  const range = parseRange(params)

  const [config, scale, kpis, snapshot, topIssues, topWins, insights, trend, distribution, recent] =
    await Promise.all([
      getConfig(),
      getRatingScale(),
      getKpis(range),
      getTodaySnapshot(range),
      getTopIssues(range, 'negative'),
      getTopIssues(range, 'positive'),
      getInsights(range),
      getTrend(range),
      getRatingDistribution(range),
      getFeedbackList({ from: range.from, to: range.to }, { page: 1, pageSize: 6 }),
    ])

  const supabase = await createClient()
  const { data: kioskRows } = await supabase
    .from('kiosks')
    .select('label, last_seen_at')
    .eq('outlet_id', user.outletId)
    .eq('active', true)

  const biggestIssue = topIssues.find((issue) => (issue.mentions.value ?? 0) > 0) ?? null
  const biggestWin = topWins.find((issue) => (issue.mentions.value ?? 0) > 0) ?? null
  const feedbackHref = `/admin/feedback?${rangeToParams(range).toString()}`

  return (
    <div className="space-y-6">
      {/* Above everything: something is going wrong right now (§27). */}
      <AlertBanner />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-ink text-3xl">Today at a glance</h1>
          <p className="text-ink-muted mt-1 text-sm">{kpis.overall.label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <KioskStatus
            kiosks={(kioskRows ?? []).map((kiosk) => ({
              label: kiosk.label,
              lastSeenAt: kiosk.last_seen_at,
            }))}
          />
          {can(user, 'export:data') ? <ExportButton range={range} /> : null}
        </div>
      </div>

      {/* 1 — the headline numbers, each against its previous period */}
      <section>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard
            label="Overall experience"
            comparison={kpis.overall}
            format="rating"
            attentionBelow={config.thresholds.category_attention}
          />
          {kpis.categories.map((category) => (
            <KpiCard
              key={category.categoryId}
              label={category.name}
              comparison={category.score}
              format="rating"
              attentionBelow={config.thresholds.category_attention}
              footnote={
                category.ratingCount === 0
                  ? undefined
                  : `${category.ratingCount} rating${category.ratingCount === 1 ? '' : 's'} · ${category.negativeCount} negative`
              }
            />
          ))}
        </div>
      </section>

      {/* 2 — the most important block on the page */}
      <section>
        <SectionHeading
          title="What needs attention?"
          note="Generated from the data, ranked by severity then magnitude."
        />
        {insights.length > 0 ? (
          // A single insight spans the row rather than sitting in a half-width
          // card next to nothing — an empty column reads as a failed render.
          <div className={cn('grid gap-3', insights.length > 1 && 'lg:grid-cols-2')}>
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        ) : (
          <InsightsEmpty
            message={
              (kpis.feedbackCount.value ?? 0) === 0
                ? 'No feedback in this period yet.'
                : 'Nothing has crossed an attention threshold in this period.'
            }
          />
        )}
      </section>

      {/* 3 — trend and shape. The average, and what the average is hiding. */}
      <section className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="Satisfaction trend" note="Daily average. Gaps are days with no feedback.">
          <TrendChart points={trend} height={236} />
        </Panel>
        <Panel title="Rating distribution" note="How the five faces were pressed.">
          <RatingDonut buckets={distribution} />
        </Panel>
      </section>

      {/* 4 — problems and strengths, side by side (§22) */}
      <section className="grid gap-3 lg:grid-cols-2">
        <HighlightCard
          kind="issue"
          title="Biggest issue"
          issue={biggestIssue}
          href={insightHref({
            from: range.from,
            to: range.to,
            issueId: biggestIssue?.issueId,
            ratingBand: 'negative',
          })}
          emptyMessage="No issues were flagged in this period."
        />
        <HighlightCard
          kind="win"
          title="Biggest win"
          issue={biggestWin}
          href={insightHref({
            from: range.from,
            to: range.to,
            issueId: biggestWin?.issueId,
            ratingBand: 'positive',
          })}
          emptyMessage="Nothing was singled out for praise in this period."
        />
      </section>

      {/* 5 — the counts */}
      <section>
        <SectionHeading title="Snapshot" />
        <SnapshotStrip snapshot={snapshot} />
      </section>

      {/* 6 — ranked, so the first line of each column is the next thing to do */}
      <section className="grid gap-3 lg:grid-cols-2">
        <Panel
          title="Top areas of improvement"
          note="What guests flagged when something went wrong."
        >
          <IssueBars
            issues={topIssues}
            range={range}
            kind="negative"
            emptyMessage="No issues were flagged in this period."
          />
        </Panel>
        <Panel
          title="What customers love"
          note="What guests chose when asked what they loved most."
        >
          <IssueBars
            issues={topWins}
            range={range}
            kind="positive"
            emptyMessage="No guest has picked a highlight in this period yet."
          />
        </Panel>
      </section>

      {/* 7 — raw data, last (§14.6) */}
      <section>
        <Panel
          title="Recent feedback"
          note="The latest submissions, verbatim."
          action={
            <Link
              href={feedbackHref}
              className="text-accent hover:text-accent-hover inline-flex items-center gap-1.5 text-sm font-semibold"
            >
              View all
              <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          }
        >
          <RecentFeedback items={recent.items} scale={scale} />
        </Panel>
      </section>
    </div>
  )
}
