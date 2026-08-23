'use client'

import { Download } from 'lucide-react'
import { rangeToParams, type DateRange } from '@/lib/range'

/**
 * Downloads the §10 workbook for the current window.
 *
 * A plain link rather than a fetch: the browser's own download handling is
 * better than anything reimplemented with a blob, and the response is streamed.
 */
export function ExportButton({ range }: { range: DateRange }) {
  const params = rangeToParams(range)
  params.set('scope', 'current')

  return (
    <a
      href={`/api/export?${params.toString()}`}
      className="text-accent-ink hover:bg-accent-hover inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
      style={{ background: 'var(--color-accent)' }}
    >
      <Download size={15} strokeWidth={2.2} aria-hidden="true" />
      Export to Excel
    </a>
  )
}
