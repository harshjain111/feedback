'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/cn'

const TABS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'guests', label: 'Guests' },
]

export function ReportTabs({ current }: { current: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const select = (key: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('type', key)
    // Each report has its own natural window, so an explicit range chosen for
    // the previous tab should not silently carry over.
    params.delete('range')
    params.delete('from')
    params.delete('to')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="border-line bg-surface inline-flex rounded-lg border p-1">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => select(tab.key)}
          aria-pressed={current === tab.key}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            current === tab.key
              ? 'bg-accent text-accent-ink'
              : 'text-ink-soft hover:bg-ground-sunk',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
