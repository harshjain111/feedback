'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="border-line-strong text-ink-soft hover:bg-ground-sunk inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
    >
      <Printer size={13} strokeWidth={2} aria-hidden="true" />
      Print
    </button>
  )
}
