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
      className="border-line-strong text-ink-soft hover:bg-ground-sunk inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
    >
      <Download size={13} strokeWidth={2} aria-hidden="true" />
      Export to Excel
    </a>
  )
}
