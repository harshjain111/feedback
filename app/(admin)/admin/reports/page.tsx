import { redirect } from 'next/navigation'
import { ExportButton } from '@/components/admin/ExportButton'
import { PrintButton } from '@/components/admin/PrintButton'
import { ReportTabs } from '@/components/admin/ReportTabs'
import { SectionHeading } from '@/components/admin/SectionHeading'
import { DeltaBadge } from '@/components/admin/DeltaBadge'
import { requireUser } from '@/lib/auth'
import { can } from '@/lib/permissions'
import {
  getCategoryPerformance,
  getGuestList,
  getKpis,
  getThemeBreakdown,
  getTopIssues,
  getTrend,
} from '@/lib/queries'
import { parseRange, rangeForPreset, type RangePreset } from '@/lib/range'
import { formatIST, toLocalDate } from '@/lib/time'

/**
 * Reports (§38, Prompt 40).
 *
 * Daily, weekly, monthly and guest views over the same query layer — the
 * difference between them is the window and the emphasis, not the data, so they
 * share one page rather than four near-identical ones.
 *
 * Everything here prints. The print stylesheet drops the app chrome so a
 * manager can put a week on paper for a staff meeting without a screenshot.
 */

const PRESET_FOR: Record<string, RangePreset> = {
  daily: 'today',
  weekly: '7d',
  monthly: '30d',
  guests: '30d',
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser('/admin/reports')
  if (!can(user, 'view:reports')) redirect('/admin/feedback')

  const params = await searchParams
  const type = typeof params.type === 'string' && PRESET_FOR[params.type] ? params.type : 'daily'

  // A report has its own natural window; the header filter still wins if the
  // user has explicitly chosen one.
  const range =
    typeof params.range === 'string'
      ? parseRange(params)
      : rangeForPreset(PRESET_FOR[type]!, toLocalDate())

  const [kpis, categories, issues, wins, themes, trend, guests] = await Promise.all([
    getKpis(range),
    getCategoryPerformance(range),
    getTopIssues(range, 'negative'),
    getTopIssues(range, 'positive'),
    getThemeBreakdown(range, 'negative'),
    getTrend(range),
    getGuestList('repeat', { page: 1, pageSize: 20 }),
  ])

  const daysWithData = trend.filter((point) => point.value !== null).length

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <SectionHeading
          title="Reports"
          note="Everything on this page prints cleanly."
          level="page"
        />
        <div className="flex gap-2">
          {can(user, 'export:data') ? <ExportButton range={range} /> : null}
          <PrintButton />
        </div>
      </div>

      <div className="print:hidden">
        <ReportTabs current={type} />
      </div>

      {/* Print-only masthead: a sheet of paper needs to say what it is. */}
      <header className="hidden print:block">
        <h1 className="text-xl font-semibold">All India Café — {titleFor(type)}</h1>
        <p className="text-sm">
          {range.from} to {range.to} · generated {formatIST(new Date())}
        </p>
      </header>

      <section>
        <SectionHeading title="Headline" note={kpis.overall.label} />
        <div className="border-line bg-surface grid grid-cols-2 gap-4 rounded-2xl border p-5 sm:grid-cols-4">
          <Figure
            label="Feedbacks"
            value={kpis.feedbackCount.value}
            comparison={kpis.feedbackCount}
          />
          <Figure
            label="Average experience"
            value={kpis.overall.value}
            comparison={kpis.overall}
            decimals={2}
          />
          <Figure
            label="Positive"
            value={kpis.positivePct.value}
            comparison={kpis.positivePct}
            suffix="%"
          />
          <Figure
            label="Complaint rate"
            value={kpis.complaintRate.value}
            comparison={kpis.complaintRate}
            suffix="%"
            lowerIsBetter
          />
        </div>
        <p className="text-ink-muted mt-2 text-xs">
          {daysWithData} of {trend.length} days in this window had feedback.
        </p>
      </section>

      <section>
        <SectionHeading title="By category" />
        <table className="border-line w-full border text-sm">
          <thead className="bg-ground-sunk">
            <tr className="text-ink-muted text-left text-xs uppercase">
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 text-right font-medium">Score</th>
              <th className="px-3 py-2 text-right font-medium">Ratings</th>
              <th className="px-3 py-2 text-right font-medium">Negative</th>
              <th className="px-3 py-2 font-medium">Change</th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {categories.map((category) => (
              <tr key={category.categoryId}>
                <td className="text-ink px-3 py-2">{category.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {category.score.value === null ? '—' : category.score.value.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{category.ratingCount}</td>
                <td className="px-3 py-2 text-right tabular-nums">{category.negativeCount}</td>
                <td className="px-3 py-2">
                  <DeltaBadge comparison={category.score} polarity="higher-is-better" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <RankedList
          title="Top complaints"
          rows={issues
            .filter((issue) => (issue.mentions.value ?? 0) > 0)
            .map((issue) => ({ label: issue.name, value: issue.mentions.value ?? 0 }))}
          empty="No issues were raised."
        />
        <RankedList
          title="Top compliments"
          rows={wins
            .filter((issue) => (issue.mentions.value ?? 0) > 0)
            .map((issue) => ({ label: issue.name, value: issue.mentions.value ?? 0 }))}
          empty="No highlights were picked."
        />
      </section>

      {type === 'guests' ? (
        <section>
          <SectionHeading title="Repeat guests" note="Phone numbers are masked in reports." />
          <table className="border-line w-full border text-sm">
            <thead className="bg-ground-sunk">
              <tr className="text-ink-muted text-left text-xs uppercase">
                <th className="px-3 py-2 font-medium">Guest</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 text-right font-medium">Visits</th>
                <th className="px-3 py-2 text-right font-medium">Average</th>
                <th className="px-3 py-2 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {guests.items.map((guest) => (
                <tr key={guest.guestId}>
                  <td className="text-ink px-3 py-2">{guest.name ?? guest.guestCode}</td>
                  <td className="text-ink-soft px-3 py-2">{guest.phoneMasked ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{guest.totalFeedbacks}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {guest.averageRating === null ? '—' : guest.averageRating.toFixed(2)}
                  </td>
                  <td className="text-ink-soft px-3 py-2">{guest.lastFeedbackDate ?? '—'}</td>
                </tr>
              ))}
              {guests.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-ink-muted px-3 py-4 text-center">
                    No repeat guests yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : (
        <RankedList
          title="Comment themes"
          rows={themes.map((theme) => ({ label: theme.name, value: theme.mentions.value ?? 0 }))}
          empty="No comment matched a theme in this window."
        />
      )}
    </div>
  )
}

function titleFor(type: string): string {
  return (
    {
      daily: 'Daily report',
      weekly: 'Weekly report',
      monthly: 'Monthly report',
      guests: 'Guest report',
    }[type] ?? 'Report'
  )
}

function Figure({
  label,
  value,
  comparison,
  suffix = '',
  decimals = 0,
  lowerIsBetter = false,
}: {
  label: string
  value: number | null
  comparison: Parameters<typeof DeltaBadge>[0]['comparison']
  suffix?: string
  decimals?: number
  lowerIsBetter?: boolean
}) {
  return (
    <div>
      <p className="text-ink-muted text-[11px] tracking-wide uppercase">{label}</p>
      <p className="font-display text-ink mt-1 text-2xl tabular-nums">
        {value === null ? '—' : `${value.toFixed(decimals)}${suffix}`}
      </p>
      <div className="mt-0.5">
        <DeltaBadge
          comparison={comparison}
          polarity={lowerIsBetter ? 'lower-is-better' : 'higher-is-better'}
        />
      </div>
    </div>
  )
}

function RankedList({
  title,
  rows,
  empty,
}: {
  title: string
  rows: { label: string; value: number }[]
  empty: string
}) {
  return (
    <section>
      <SectionHeading title={title} />
      {rows.length === 0 ? (
        <p className="border-line text-ink-muted rounded-lg border border-dashed p-3 text-xs">
          {empty}
        </p>
      ) : (
        <ul className="border-line divide-line divide-y border">
          {rows.slice(0, 8).map((row) => (
            <li key={row.label} className="flex justify-between px-3 py-1.5 text-sm">
              <span className="text-ink">{row.label}</span>
              <span className="text-ink-soft tabular-nums">{row.value}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
