import Link from 'next/link'
import { DeltaBadge } from './DeltaBadge'
import { insightHref } from '@/lib/analytics/insights'
import type { ThemeCount } from '@/lib/queries/types'
import type { DateRange } from '@/lib/range'

/**
 * TOP NEGATIVE THEMES / TOP POSITIVE THEMES (§26).
 *
 * A theme is an index over what guests wrote, never a replacement for it
 * (§14.10). Clicking one opens the feedback list filtered to those comments,
 * where the original text is shown in full — the analysis is a way in, not the
 * thing management is meant to read.
 */
function ThemeList({
  themes,
  range,
  kind,
  emptyMessage,
}: {
  themes: ThemeCount[]
  range: DateRange
  kind: 'negative' | 'positive'
  emptyMessage: string
}) {
  if (themes.length === 0) {
    return (
      <div className="border-line text-ink-muted rounded-xl border border-dashed p-5 text-sm">
        {emptyMessage}
      </div>
    )
  }

  return (
    <ul className="border-line bg-surface divide-line divide-y rounded-xl border">
      {themes.map((theme) => (
        <li key={theme.themeId}>
          <Link
            href={insightHref({ from: range.from, to: range.to, themeId: theme.themeId })}
            className="hover:bg-ground-sunk/60 flex items-center justify-between gap-4 px-4 py-2.5"
          >
            <span className="min-w-0">
              <span className="text-ink block text-sm font-medium">{theme.name}</span>
              <span className="text-ink-muted text-xs">
                across {theme.feedbackCount} comment{theme.feedbackCount === 1 ? '' : 's'}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <DeltaBadge
                comparison={theme.mentions}
                polarity={kind === 'negative' ? 'lower-is-better' : 'higher-is-better'}
              />
              <span className="text-ink text-sm tabular-nums">{theme.mentions.value ?? 0}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function ThemeTables({
  negative,
  positive,
  range,
}: {
  negative: ThemeCount[]
  positive: ThemeCount[]
  range: DateRange
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="text-ink-muted mb-2 text-xs font-semibold tracking-[0.14em] uppercase">
          Top negative themes
        </h3>
        <ThemeList
          themes={negative}
          range={range}
          kind="negative"
          emptyMessage="No negative themes matched any comment in this period."
        />
      </div>
      <div>
        <h3 className="text-ink-muted mb-2 text-xs font-semibold tracking-[0.14em] uppercase">
          Top positive themes
        </h3>
        <ThemeList
          themes={positive}
          range={range}
          kind="positive"
          emptyMessage="No positive themes matched any comment in this period."
        />
      </div>
    </div>
  )
}
