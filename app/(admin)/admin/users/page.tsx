import { redirect } from 'next/navigation'
import { SectionHeading } from '@/components/admin/SectionHeading'
import { UsersTable, type UserRow } from '@/components/admin/UsersTable'
import { requireUser } from '@/lib/auth'
import { actionsFor, can, isRole, ROLES } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'

/**
 * Users and roles (§42, Prompt 39).
 *
 * The matrix is spelled out on the page. A manager assigning a role should be
 * able to see what they are granting without reading the spec, and "STAFF" on
 * its own tells them nothing.
 */
export default async function AdminUsersPage() {
  const user = await requireUser('/admin/users')
  if (!can(user, 'manage:users')) redirect('/admin')

  const client = await createClient()
  const { data } = await client
    .from('app_users')
    .select('user_id, name, email, role, active')
    .eq('outlet_id', user.outletId)
    .order('role')
    .order('name')

  const users: UserRow[] = (data ?? [])
    .filter((row) => isRole(row.role))
    .map((row) => ({
      userId: row.user_id,
      name: row.name,
      email: row.email,
      role: row.role as UserRow['role'],
      active: row.active,
    }))

  return (
    <div className="max-w-4xl space-y-5">
      <SectionHeading
        title="Users"
        note="Roles are enforced by the database, not just by what this page shows. Hiding a link never grants or denies anything on its own."
        level="page"
      />

      <UsersTable
        users={users}
        currentUserId={user.userId}
        currentRole={user.role}
        canDelete={can(user, 'delete:users')}
      />

      <section>
        <SectionHeading title="What each role can do" />
        <div className="border-line bg-surface overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-line text-ink-muted border-b text-left text-xs uppercase">
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Can</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {ROLES.map((role) => (
                <tr key={role} className="align-top">
                  <td className="text-ink px-4 py-2.5 font-medium whitespace-nowrap">{role}</td>
                  <td className="text-ink-soft px-4 py-2.5 text-xs">
                    {actionsFor(role).join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-ink-muted mt-2 text-xs">
          Deactivating a user removes every one of these immediately, whatever their role.
        </p>
      </section>
    </div>
  )
}
