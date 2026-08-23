import { redirect } from 'next/navigation'
import { CategoryTable } from '@/components/admin/CategoryTable'
import { IssueTable } from '@/components/admin/IssueTable'
import { SectionHeading } from '@/components/admin/SectionHeading'
import { ThemeTables } from '@/components/admin/ThemeTables'
import { TimeAndDay } from '@/components/admin/TimeAndDay'
import { TrendChart } from '@/components/admin/TrendChart'
import { requireUser } from '@/lib/auth'
import { getConfig } from '@/lib/config'
import { can } from '@/lib/permissions'
import {
  getCategoryPerformance,
  getCategoryTrends,
  getThemeBreakdown,
  getTopIssues,
  getTrend,
} from '@/lib/queries'
import { getDayOfWeekBreakdown, getHourBucketBreakdown } from '@/lib/queries/time'
import { parseRange } from '@/lib/range'

/**
 * Analytics — trends, category performance, comment intelligence and the
 * time/day cuts (§24–§26, §33–§34).
 *
 * Today at a Glance answers "what is happening now". This page answers "what is
 * happening over time", which is a different question and deserves the space to
 * be read slowly rather than in sixty seconds.
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser('/admin/analytics')
  if (!can(user, 'view:analytics')) redirect('/admin/feedback')

  const params = await searchParams
  const range = parseRange(params)

  const [
    config,
    overall,
    categoryTrends,
    categories,
    negativeIssues,
    positiveIssues,
    negativeThemes,
    positiveThemes,
    byHour,
    byDay,
  ] = await Promise.all([
    getConfig(),
    getTrend(range),
    getCategoryTrends(range),
    getCategoryPerformance(range),
    getTopIssues(range, 'negative'),
    getTopIssues(range, 'positive'),
    getThemeBreakdown(range, 'negative'),
    getThemeBreakdown(range, 'positive'),
    getHourBucketBreakdown(range),
    getDayOfWeekBreakdown(range),
  ])

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading
          title="Overall satisfaction"
          note="A day with no feedback is a gap in the line, never a zero."
        />
        <div className="border-line bg-surface rounded-xl border p-4">
          <TrendChart points={overall} height={260} />
        </div>
      </section>

      <section>
        <SectionHeading title="By category" />
        <div className="grid gap-3 lg:grid-cols-2">
          {categoryTrends.map((series) => (
            <div key={series.categoryId} className="border-line bg-surface rounded-xl border p-4">
              <h3 className="text-ink mb-2 text-sm font-semibold">{series.name}</h3>
              <TrendChart points={series.points} height={180} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          title="Category performance"
          note={`Status is measured against the configured thresholds — attention below ${config.thresholds.category_attention}, strong at ${config.thresholds.category_strong}.`}
        />
        <CategoryTable categories={categories} range={range} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeading title="Top areas of improvement" />
          <IssueTable issues={negativeIssues} range={range} kind="negative" />
        </div>
        <div>
          <SectionHeading title="Most loved" />
          <IssueTable issues={positiveIssues} range={range} kind="positive" />
        </div>
      </section>

      <section>
        <SectionHeading
          title="Comment intelligence"
          note="Themes are an index over what guests wrote. The original comment is always shown in full."
        />
        <ThemeTables negative={negativeThemes} positive={positiveThemes} range={range} />
      </section>

      <section>
        <SectionHeading
          title="Time and day"
          note={`Patterns are only claimed with at least ${config.thresholds.min_sample_size} ratings behind them.`}
        />
        <TimeAndDay
          byHour={byHour}
          byDay={byDay}
          minSample={config.thresholds.min_sample_size}
          range={range}
        />
      </section>
    </div>
  )
}
