'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Settings,
  Users,
  UserCog,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { can, type Action, type Role } from '@/lib/permissions'
import { cn } from '@/lib/cn'

type NavItem = { href: string; label: string; icon: LucideIcon; requires: Action }

/**
 * Order matters (§14.6): Problems → Trends → Insights → Actions → Raw Data.
 * "Today" sits first because that is where a problem surfaces; Settings and
 * Users are administration, not daily work, so they sit at the bottom.
 */
const NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, requires: 'view:dashboard' },
  {
    href: '/admin/feedback',
    label: 'Feedbacks',
    icon: MessageSquareText,
    requires: 'view:feedback',
  },
  { href: '/admin/guests', label: 'Guests', icon: Users, requires: 'view:guests' },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3, requires: 'view:analytics' },
  { href: '/admin/reports', label: 'Reports', icon: FileText, requires: 'view:reports' },
  { href: '/admin/settings', label: 'Settings', icon: Settings, requires: 'manage:cms' },
  { href: '/admin/users', label: 'Users', icon: UserCog, requires: 'manage:users' },
]

/**
 * The admin sidebar.
 *
 * Dark, so the numbers are the brightest thing on screen — a dashboard read at
 * a glance should put contrast where the data is, not on the furniture.
 *
 * Links are filtered by the same can() the route guards use. Hiding a link is a
 * courtesy; the guard and RLS are what stop the request (§8).
 */
export function Sidebar({ role, name, email }: { role: Role; name: string; email: string }) {
  const pathname = usePathname()
  const actor = { role, active: true }
  const items = NAV.filter((item) => can(actor, item.requires))

  return (
    <nav
      aria-label="Admin sections"
      className="flex w-60 shrink-0 flex-col"
      style={{ background: 'var(--color-sidebar)' }}
    >
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={{ background: 'var(--color-sidebar-soft)' }}
        >
          <svg viewBox="0 0 100 100" className="h-5 w-5 text-white" aria-hidden="true">
            <path
              d="M35 44 h26 v11 a13 13 0 0 1 -26 0 z"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinejoin="round"
            />
            <path
              d="M61 47 h4.5 a5 5 0 0 1 0 10 H61"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold tracking-[0.16em] text-white/60 uppercase">
            All India Café
          </span>
          <span className="block truncate text-sm font-semibold text-white">
            Experience Intelligence
          </span>
        </span>
      </div>

      <ul className="flex-1 space-y-0.5 px-3">
        {items.map((item) => {
          const active =
            item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active ? 'text-white' : 'text-white/65 hover:bg-white/5 hover:text-white',
                )}
                style={active ? { background: 'var(--color-sidebar-soft)' } : undefined}
              >
                <item.icon size={17} strokeWidth={1.8} aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="border-t border-white/10 p-3">
        <p className="truncate px-3 text-xs font-medium text-white">{name}</p>
        <p className="truncate px-3 text-[11px] text-white/50">
          {role} · {email}
        </p>
        <button
          type="button"
          onClick={async () => {
            await createClient().auth.signOut()
            window.location.href = '/admin/login'
          }}
          className="mt-2 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/65 hover:bg-white/5 hover:text-white"
        >
          <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
          Logout
        </button>
      </div>
    </nav>
  )
}
