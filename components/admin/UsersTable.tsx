'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { deleteUser, inviteUser, setUserActive, setUserRole } from '@/lib/actions/users'
import { ROLES, type Role } from '@/lib/permissions'
import { cn } from '@/lib/cn'

export type UserRow = {
  userId: string
  name: string
  email: string
  role: Role
  active: boolean
}

/**
 * User management (§42).
 *
 * Deactivate is the prominent action and delete is not: deactivating keeps the
 * audit trail and the follow-up notes attached to a real person, while deleting
 * throws that away. §8 makes deletion OWNER-only, and the button is simply
 * absent for anyone else rather than present-and-failing.
 */
export function UsersTable({
  users,
  currentUserId,
  currentRole,
  canDelete,
}: {
  users: UserRow[]
  currentUserId: string
  currentRole: Role
  canDelete: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [draft, setDraft] = useState({ email: '', name: '', role: 'STAFF' as Role })
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null)

  const run = (action: () => Promise<{ ok: boolean; error?: string; password?: string }>) => {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) setError(result.error ?? 'Something went wrong')
    })
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-bad)]">
          {error}
        </p>
      ) : null}

      {issued ? (
        <div className="rounded-2xl border border-[color:var(--color-good)]/40 bg-[color:var(--color-good)]/5 p-4">
          <p className="text-ink text-sm font-medium">Account created for {issued.email}</p>
          <p className="text-ink-soft mt-1 text-xs">
            Temporary password: <code className="font-mono">{issued.password}</code>
          </p>
          <p className="text-ink-muted mt-1 text-[11px]">
            Shown once. Send it to them by a channel you trust and ask them to change it.
          </p>
        </div>
      ) : null}

      <div className="border-line bg-surface overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-line text-ink-muted border-b text-left text-xs uppercase">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              {canDelete ? <th className="w-16 px-4 py-2.5 font-medium" /> : null}
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {users.map((user) => {
              const isSelf = user.userId === currentUserId
              return (
                <tr key={user.userId} className={cn(!user.active && 'opacity-55')}>
                  <td className="text-ink px-4 py-2.5">
                    {user.name}
                    {isSelf ? <span className="text-ink-muted ml-1.5 text-xs">(you)</span> : null}
                  </td>
                  <td className="text-ink-soft px-4 py-2.5">{user.email}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={user.role}
                      disabled={pending || isSelf}
                      title={isSelf ? 'You cannot change your own role.' : undefined}
                      onChange={(event) => run(() => setUserRole(user.userId, event.target.value))}
                      className="border-line-strong rounded-lg border px-2 py-1 text-sm disabled:opacity-50"
                    >
                      {ROLES.filter(
                        (role) =>
                          role !== 'OWNER' || currentRole === 'OWNER' || user.role === 'OWNER',
                      ).map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={user.active}
                        disabled={pending || isSelf}
                        onChange={(event) =>
                          run(() => setUserActive(user.userId, event.target.checked))
                        }
                        className="h-4 w-4"
                      />
                      <span className="text-ink-muted">{user.active ? 'Active' : 'Disabled'}</span>
                    </label>
                  </td>
                  {canDelete ? (
                    <td className="px-4 py-2.5">
                      {isSelf ? null : (
                        <button
                          type="button"
                          disabled={pending}
                          aria-label={`Delete ${user.name}`}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete ${user.name}?\n\nDeactivating is almost always better: it keeps their notes and audit trail attached to a real person. Deletion cannot be undone.`,
                              )
                            ) {
                              run(() => deleteUser(user.userId))
                            }
                          }}
                          className="text-ink-muted rounded border p-1 hover:text-[color:var(--color-bad)]"
                        >
                          <Trash2 size={13} strokeWidth={2} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {inviting ? (
        <div className="border-line bg-surface flex flex-wrap items-end gap-3 rounded-2xl border p-3">
          <label className="flex flex-col gap-1">
            <span className="text-ink-muted text-[11px] uppercase">Name</span>
            <input
              type="text"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className="border-line-strong rounded-lg border px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-ink-muted text-[11px] uppercase">Email</span>
            <input
              type="email"
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
              className="border-line-strong rounded-lg border px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-ink-muted text-[11px] uppercase">Role</span>
            <select
              value={draft.role}
              onChange={(event) => setDraft({ ...draft, role: event.target.value as Role })}
              className="border-line-strong rounded-lg border px-2.5 py-1.5 text-sm"
            >
              {ROLES.filter((role) => role !== 'OWNER' || currentRole === 'OWNER').map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await inviteUser(draft.email, draft.name, draft.role)
                if (result.ok && result.password) {
                  setIssued({ email: draft.email.trim().toLowerCase(), password: result.password })
                  setInviting(false)
                  setDraft({ email: '', name: '', role: 'STAFF' })
                }
                return result
              })
            }
            className="bg-accent text-accent-ink hover:bg-accent-hover rounded-lg px-3 py-1.5 text-xs font-semibold"
          >
            Create account
          </button>
          <button
            type="button"
            onClick={() => setInviting(false)}
            className="border-line text-ink-soft rounded-lg border px-3 py-1.5 text-xs"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setInviting(true)}
          className="border-line-strong text-ink-soft hover:bg-ground-sunk inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
        >
          <Plus size={13} strokeWidth={2.2} aria-hidden="true" />
          Add a user
        </button>
      )}
    </div>
  )
}
