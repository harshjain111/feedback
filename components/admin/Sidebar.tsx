'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  Users,
  UserCog,
  type LucideIcon,
} from 'lucide-react'
import { can, type Action, type Role } from '@/lib/permissions'
import { cn } from '@/lib/cn'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  requires: Action
}

/**
 * Order matters (§14.6): Problems → Trends → Insights → Actions → Raw Data.
 * "Today" sits first because that is where a problem is surfaced; Settings and
 * Users are administration, not daily work, so they sit at the bottom.
 */
const NAV: NavItem[] = [
  { href: '/admin', label: 'Today', icon: LayoutDashboard, requires: 'view:dashboard' },
  {
    href: '/admin/feedback',
    label: 'Feedback',
    icon: MessageSquareText,
    requires: 'view:feedback',
  },
  { href: '/admin/guests', label: 'Guests', icon: Users, requires: 'view:guests' },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3, requires: 'view:analytics' },
  { href: '/admin/reports', label: 'Reports', icon: FileText, requires: 'view:reports' },
  { href: '/admin/settings', label: 'Settings', icon: Settings, requires: 'manage:cms' },
  { href: '/admin/users', label: 'Users', icon: UserCog, requires: 'manage:users' },
]

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname()
  const actor = { role, active: true }

  // Filtered by the same can() the route guards use. Hiding a link is a
  // courtesy; the guard and RLS are what actually stop the request (§8).
  const items = NAV.filter((item) => can(actor, item.requires))

  return (
    <nav
      aria-label="Admin sections"
      className="border-line bg-surface flex w-56 shrink-0 flex-col border-r"
    >
      <div className="border-line border-b px-5 py-5">
        <p className="text-accent text-[11px] font-semibold tracking-[0.16em] uppercase">
          All India Café
        </p>
        <p className="text-ink mt-1 text-sm font-semibold">Experience Intelligence</p>
      </div>

      <ul className="flex-1 space-y-0.5 p-3">
        {items.map((item) => {
          const active =
            item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent-soft text-accent'
                    : 'text-ink-soft hover:bg-ground-sunk hover:text-ink',
                )}
              >
                <item.icon size={17} strokeWidth={1.8} aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
