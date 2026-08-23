'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import {
  createReferenceRow,
  reorderReferenceRows,
  setReferenceActive,
  updateReferenceRow,
} from '@/lib/actions/settings'
import { cn } from '@/lib/cn'

/**
 * CRUD, reorder and activate/deactivate for a reference table (§36, §37).
 *
 * Rows are never deleted, only deactivated — past feedback points at them, and
 * losing the name of a category someone rated would make historical analytics
 * unreadable. Deactivating warns about exactly that, then leaves the data alone.
 *
 * Reorder is arrows rather than drag-and-drop: this is a four-to-seven row list
 * on a desktop, and arrows are keyboard-accessible and testable where a drag
 * handle is neither.
 */

export type Column = {
  key: string
  label: string
  type?: 'text' | 'colour' | 'select'
  options?: string[]
  width?: string
}

export type Row = { id: string; active: boolean; values: Record<string, string> }

export function ReferenceEditor({
  table,
  idColumn,
  columns,
  rows,
  addLabel,
  deactivateWarning,
  fixedRows = false,
}: {
  table: 'categories' | 'issues' | 'themes' | 'rating_scale'
  idColumn: string
  columns: Column[]
  rows: Row[]
  addLabel?: string
  deactivateWarning: string
  /** Rating scale rows are a fixed set of five; no add, no reorder. */
  fixedRows?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState(rows.map((row) => row.id))
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})

  const byId = new Map(rows.map((row) => [row.id, row]))
  const ordered = order.map((id) => byId.get(id)).filter((row): row is Row => Boolean(row))

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) setError(result.error ?? 'Something went wrong')
    })
  }

  const move = (index: number, delta: number) => {
    const next = [...order]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    const [moved] = next.splice(index, 1)
    if (!moved) return
    next.splice(target, 0, moved)
    setOrder(next)
    run(() => reorderReferenceRows(table, idColumn, next))
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-bad)]">
          {error}
        </p>
      ) : null}

      <div className="border-line bg-surface overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-line text-ink-muted border-b text-left text-xs uppercase">
              {!fixedRows ? <th className="w-16 px-3 py-2.5 font-medium">Order</th> : null}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-3 py-2.5 font-medium"
                  style={{ width: column.width }}
                >
                  {column.label}
                </th>
              ))}
              <th className="w-28 px-3 py-2.5 font-medium">Active</th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {ordered.map((row, index) => (
              <tr key={row.id} className={cn(!row.active && 'opacity-55')}>
                {!fixedRows ? (
                  <td className="px-3 py-2">
                    <span className="flex gap-1">
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={pending || index === 0}
                        onClick={() => move(index, -1)}
                        className="border-line text-ink-soft hover:bg-ground-sunk rounded border p-1 disabled:opacity-30"
                      >
                        <ArrowUp size={12} strokeWidth={2} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={pending || index === ordered.length - 1}
                        onClick={() => move(index, 1)}
                        className="border-line text-ink-soft hover:bg-ground-sunk rounded border p-1 disabled:opacity-30"
                      >
                        <ArrowDown size={12} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </span>
                  </td>
                ) : null}

                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-2">
                    <EditableCell
                      column={column}
                      value={row.values[column.key] ?? ''}
                      disabled={pending}
                      onCommit={(value) =>
                        run(() =>
                          updateReferenceRow(table, idColumn, row.id, { [column.key]: value }),
                        )
                      }
                    />
                  </td>
                ))}

                <td className="px-3 py-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={row.active}
                      disabled={pending}
                      onChange={(event) => {
                        if (!event.target.checked && !window.confirm(deactivateWarning)) {
                          event.preventDefault()
                          return
                        }
                        run(() => setReferenceActive(table, idColumn, row.id, event.target.checked))
                      }}
                      className="h-4 w-4"
                    />
                    <span className="text-ink-muted">{row.active ? 'Active' : 'Hidden'}</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-ink-muted text-xs">{deactivateWarning}</p>

      {!fixedRows && addLabel ? (
        adding ? (
          <div className="border-line bg-surface flex flex-wrap items-end gap-3 rounded-2xl border p-3">
            {columns.map((column) => (
              <label key={column.key} className="flex flex-col gap-1">
                <span className="text-ink-muted text-[11px] uppercase">{column.label}</span>
                <input
                  type="text"
                  value={draft[column.key] ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [column.key]: event.target.value }))
                  }
                  className="border-line-strong focus:border-accent rounded-lg border px-2.5 py-1.5 text-sm outline-none"
                />
              </label>
            ))}
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const result = await createReferenceRow(table, {
                    ...draft,
                    display_order: ordered.length + 1,
                  })
                  if (result.ok) {
                    setAdding(false)
                    setDraft({})
                    window.location.reload()
                  }
                  return result
                })
              }
              className="bg-accent text-accent-ink hover:bg-accent-hover rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="border-line text-ink-soft rounded-lg border px-3 py-1.5 text-xs"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="border-line-strong text-ink-soft hover:bg-ground-sunk inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
          >
            <Plus size={13} strokeWidth={2.2} aria-hidden="true" />
            {addLabel}
          </button>
        )
      ) : null}
    </div>
  )
}

function EditableCell({
  column,
  value,
  disabled,
  onCommit,
}: {
  column: Column
  value: string
  disabled: boolean
  onCommit: (value: string) => void
}) {
  const [current, setCurrent] = useState(value)

  if (column.type === 'select' && column.options) {
    return (
      <select
        value={current}
        disabled={disabled}
        onChange={(event) => {
          setCurrent(event.target.value)
          onCommit(event.target.value)
        }}
        className="border-line-strong rounded-lg border px-2 py-1 text-sm"
      >
        {column.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }

  if (column.type === 'colour') {
    return (
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={current}
          disabled={disabled}
          onChange={(event) => setCurrent(event.target.value)}
          onBlur={() => current !== value && onCommit(current.toUpperCase())}
          className="h-7 w-10 rounded border-0 bg-transparent p-0"
        />
        <code className="text-ink-muted text-xs">{current.toUpperCase()}</code>
      </span>
    )
  }

  return (
    <input
      type="text"
      value={current}
      disabled={disabled}
      onChange={(event) => setCurrent(event.target.value)}
      onBlur={() => current !== value && onCommit(current)}
      className="border-line-strong focus:border-accent w-full rounded-lg border px-2 py-1 text-sm outline-none"
    />
  )
}
