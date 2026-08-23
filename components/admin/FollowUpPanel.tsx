'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { StatusBadge } from './StatusBadge'
import {
  addFollowUpNote,
  assignFollowUp,
  setResolution,
  transitionFollowUp,
} from '@/lib/actions/follow-ups'
import { allowedTransitions } from '@/lib/follow-up-workflow'
import type { FeedbackDetail } from '@/lib/queries/types'

/**
 * The follow-up workflow panel (§30).
 *
 * Only legal transitions are offered, and the same map is re-checked on the
 * server — the buttons are a convenience, not the rule. Notes are append-only
 * with no edit affordance anywhere, because §28 wants a record of what was
 * done, and an editable record is not one.
 */
export function FollowUpPanel({
  followUp,
  assignees,
  canAssign,
}: {
  followUp: NonNullable<FeedbackDetail['followUp']>
  assignees: { userId: string; name: string }[]
  canAssign: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [resolution, setResolutionText] = useState(followUp.resolution ?? '')

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setError(result.error ?? 'Something went wrong')
        return
      }
      // revalidatePath on the server marks the cache stale; the open client
      // still holds the old props until it refetches. Without this the status
      // badge keeps showing OPEN after a transition that actually succeeded.
      router.refresh()
    })
  }

  const next = allowedTransitions(followUp.status)

  return (
    <section className="border-line bg-surface rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-ink-muted text-xs font-semibold tracking-[0.14em] uppercase">
            Follow-up
          </h2>
          <StatusBadge status={followUp.status} />
        </div>

        <div className="flex flex-wrap gap-2">
          {next.length === 0 ? (
            <span className="text-ink-muted text-xs">Closed — no further transitions.</span>
          ) : (
            next.map((status) => (
              <button
                key={status}
                type="button"
                disabled={pending}
                onClick={() => run(() => transitionFollowUp(followUp.followUpId, status))}
                className="border-line-strong text-ink-soft hover:bg-ground-sunk rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                Mark {status.toLowerCase()}
              </button>
            ))
          )}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-xs text-[color:var(--color-bad)]">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <label className="text-ink-muted mb-1 block text-[11px] font-medium uppercase">
            Assigned to
          </label>
          {canAssign ? (
            <select
              value={followUp.assignedTo ?? ''}
              disabled={pending}
              onChange={(event) =>
                run(() => assignFollowUp(followUp.followUpId, event.target.value || null))
              }
              className="border-line-strong bg-surface w-full rounded-lg border px-2.5 py-1.5 text-sm"
            >
              <option value="">Unassigned</option>
              {assignees.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {person.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-ink text-sm">{followUp.assignedToName ?? 'Unassigned'}</p>
          )}
        </div>

        <div>
          <label className="text-ink-muted mb-1 block text-[11px] font-medium uppercase">
            Resolution
          </label>
          <textarea
            value={resolution}
            disabled={pending}
            onChange={(event) => setResolutionText(event.target.value)}
            onBlur={() => {
              if (resolution.trim() !== (followUp.resolution ?? '').trim()) {
                run(() => setResolution(followUp.followUpId, resolution))
              }
            }}
            rows={3}
            placeholder="What was done, and what the guest said."
            className="border-line-strong bg-surface focus:border-accent w-full resize-none rounded-lg border px-2.5 py-1.5 text-sm outline-none"
          />
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-ink-muted mb-2 text-[11px] font-medium uppercase">
          Internal notes ({followUp.notes.length})
        </h3>

        {followUp.notes.length > 0 ? (
          <ol className="border-line divide-line mb-3 divide-y rounded-lg border">
            {followUp.notes.map((entry) => (
              <li key={entry.noteId} className="px-3 py-2">
                <p className="text-ink-muted text-[11px]">
                  {entry.authorName ?? 'Unknown'} · {new Date(entry.createdAt).toLocaleString()}
                </p>
                <p className="text-ink mt-0.5 text-sm whitespace-pre-wrap">{entry.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-ink-muted mb-3 text-xs">No notes yet.</p>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={note}
            disabled={pending}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add a note…"
            className="border-line-strong bg-surface focus:border-accent flex-1 rounded-lg border px-2.5 py-1.5 text-sm outline-none"
          />
          <button
            type="button"
            disabled={pending || note.trim() === ''}
            onClick={() =>
              run(async () => {
                const result = await addFollowUpNote(followUp.followUpId, note)
                if (result.ok) setNote('')
                return result
              })
            }
            className="bg-accent text-accent-ink hover:bg-accent-hover rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </section>
  )
}
