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
        {/*
          A stacked list rather than a two-column table, at every width. The
          "Can" column is a long run of action names, which is what forced the
          560px minimum and pushed it off a phone; wrapping it under its own
          heading reads better wide as well, so there is no second layout here.
        */}
        <dl className="border-line bg-surface divide-line divide-y rounded-2xl border">
          {ROLES.map((role) => (
            <div key={role} className="px-4 py-3 sm:flex sm:gap-6">
              <dt className="text-ink text-sm font-medium sm:w-28 sm:shrink-0">{role}</dt>
              <dd className="text-ink-soft mt-1 text-xs sm:mt-0">
                {actionsFor(role).join(' · ')}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-ink-muted mt-2 text-xs">
          Deactivating a user removes every one of these immediately, whatever their role.
        </p>
      </section>
    </div>
  )
}
