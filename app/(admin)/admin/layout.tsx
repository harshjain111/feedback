import { requireUser } from '@/lib/auth'

/**
 * The guard for every admin route (§8).
 *
 * A layout is the right place for it: no page under /admin can render without
 * passing through here, so there is no "I forgot to add the check to the new
 * page" failure mode. Per-action permissions are checked in the pages
 * themselves, and RLS checks everything again underneath.
 *
 * Prompt 19 adds the sidebar, header and date-range filter around this.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUser()

  return <div className="bg-ground min-h-dvh">{children}</div>
}
