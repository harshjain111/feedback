'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TrendPoint } from '@/lib/queries/types'

/**
 * Daily satisfaction over time (§25).
 *
 * `connectNulls` is false on purpose. A day with no feedback is a gap, not a
 * zero and not a straight line drawn across it — interpolating a closed Monday
 * would invent data the café never collected, and §14.10's respect for the raw
 * record applies to charts too.
 *
 * The y-axis is pinned to the rating scale rather than auto-scaled. Auto-scaling
 * turns a 4.6 → 4.4 wobble into a cliff, which is exactly the kind of chart that
 * makes people stop trusting a dashboard.
 */
export function TrendChart({
  points,
  colour = 'var(--color-accent)',
  height = 220,
  domain = [1, 5],
}: {
  points: TrendPoint[]
  colour?: string
  height?: number
  domain?: [number, number]
}) {
  const withData = points.filter((point) => point.value !== null)

  if (withData.length === 0) {
    return (
      <div
        className="border-line text-ink-muted flex items-center justify-center rounded-lg border border-dashed text-sm"
        style={{ height }}
      >
        No feedback in this period.
      </div>
    )
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
          <CartesianGrid stroke="var(--color-line)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-line)' }}
            // Sparse labels: a 90-day window with 90 dates is unreadable.
            interval="preserveStartEnd"
            minTickGap={40}
            tickFormatter={(value: string) => value.slice(5)}
          />
          <YAxis
            domain={domain}
            allowDecimals
            tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: '1px solid var(--color-line)',
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--color-ink-muted)' }}
            formatter={(value: number | string, _name, item) => {
              const count = (item?.payload as TrendPoint | undefined)?.count ?? 0
              return [`${value} (${count} feedback${count === 1 ? '' : 's'})`, 'Average']
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={colour}
            strokeWidth={2}
            dot={{ r: 2.5, strokeWidth: 0, fill: colour }}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
