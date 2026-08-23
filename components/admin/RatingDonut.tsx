'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { RatingBucket } from '@/lib/queries/types'

/**
 * How the five faces were actually pressed.
 *
 * The average is on the KPI row already; this is the thing the average hides. A
 * 3.0 made of shrugs and a 3.0 made of half delight and half fury need opposite
 * decisions, and only the shape tells them apart.
 *
 * Colours come from rating_scale, so the ring matches the faces the guest saw.
 */
export function RatingDonut({ buckets }: { buckets: RatingBucket[] }) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0)

  if (total === 0) {
    return (
      <p className="border-line text-ink-muted rounded-2xl border border-dashed px-4 py-10 text-center text-sm">
        No ratings in this period.
      </p>
    )
  }

  // Highest first: the legend should read as a ranking, not as a scale.
  const legend = [...buckets].sort((a, b) => b.value - a.value)

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={buckets}
              dataKey="count"
              nameKey="label"
              innerRadius="66%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {buckets.map((bucket) => (
                <Cell key={bucket.value} fill={bucket.colour} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid var(--color-line)',
                fontSize: 13,
              }}
              formatter={(value: number | string, name: string | number) => [
                `${value} rating${Number(value) === 1 ? '' : 's'}`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* The hole is not decoration — it is where the total goes. */}
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="font-display text-ink text-2xl tabular-nums">{total}</span>
          <span className="text-ink-muted text-[11px] tracking-wide uppercase">ratings</span>
        </div>
      </div>

      <ul className="min-w-[11rem] flex-1 space-y-1.5">
        {legend.map((bucket) => (
          <li key={bucket.value} className="flex items-center gap-2.5 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: bucket.colour }}
              aria-hidden="true"
            />
            <span className="text-ink-soft flex-1 truncate">{bucket.label}</span>
            <span className="text-ink font-medium tabular-nums">{bucket.count}</span>
            <span className="text-ink-muted w-12 text-right text-xs tabular-nums">
              {bucket.pct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
