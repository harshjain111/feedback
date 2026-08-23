import { redirect } from 'next/navigation'
import { AlertBanner } from '@/components/admin/AlertBanner'
import { HighlightCard } from '@/components/admin/HighlightCard'
import { InsightCard, InsightsEmpty } from '@/components/admin/InsightCard'
import { KioskStatus } from '@/components/admin/KioskStatus'
import { KpiCard } from '@/components/admin/KpiCard'
import { SectionHeading } from '@/components/admin/SectionHeading'
import { SnapshotStrip } from '@/components/admin/SnapshotStrip'
import { insightHref } from '@/lib/analytics/insights'
import { requireUser } from '@/lib/auth'
import { getConfig } from '@/lib/config'
import { can } from '@/lib/permissions'
import { getKpis, getTodaySnapshot, getTopIssues } from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'
import { getInsights } from '@/lib/queries/insights'
import { parseRange } from '@/lib/range'

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

  const [config, kpis, snapshot, topIssues, topWins, insights] = await Promise.all([
    getConfig(),
    getKpis(range),
    getTodaySnapshot(range),
    getTopIssues(range, 'negative'),
    getTopIssues(range, 'positive'),
    getInsights(range),
  ])

  const supabase = await createClient()
  const { data: kioskRows } = await supabase
    .from('kiosks')
    .select('label, last_seen_at')
    .eq('outlet_id', user.outletId)
    .eq('active', true)

  const biggestIssue = topIssues.find((issue) => (issue.mentions.value ?? 0) > 0) ?? null
  const biggestWin = topWins.find((issue) => (issue.mentions.value ?? 0) > 0) ?? null
  const loved = topWins.filter((issue) => (issue.mentions.value ?? 0) > 0).slice(0, 5)

  return (
    <div className="space-y-8">
      {/* Above everything: something is going wrong right now (§27). */}
      <AlertBanner />

      {/* 1 — the headline numbers, each against its previous period */}
      <section>
        <SectionHeading
          title="Experience"
          note={kpis.overall.label}
          action={
            <KioskStatus
              kiosks={(kioskRows ?? []).map((kiosk) => ({
                label: kiosk.label,
                lastSeenAt: kiosk.last_seen_at,
              }))}
            />
          }
        />
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
          <div className="grid gap-3 lg:grid-cols-2">
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

      {/* 3 — problems and strengths, side by side (§22) */}
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

      {/* 4 — the counts */}
      <section>
        <SectionHeading title="Snapshot" />
        <SnapshotStrip snapshot={snapshot} />
      </section>

      {/* 5 — balance: what the café is getting right (§22) */}
      <section>
        <SectionHeading
          title="What customers love"
          note="What guests chose when asked what they loved most."
        />
        {loved.length > 0 ? (
          <ul className="border-line bg-surface divide-line divide-y rounded-xl border">
            {loved.map((issue) => (
              <li key={issue.issueId} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-ink text-sm font-medium">{issue.name}</span>
                <span className="text-ink-soft text-sm tabular-nums">
                  {issue.mentions.value ?? 0}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <InsightsEmpty message="No guest has picked a highlight in this period yet." />
        )}
      </section>
    </div>
  )
}
