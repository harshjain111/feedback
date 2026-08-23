import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  ListOrdered,
  MessageSquareText,
  Palette,
  Phone,
  SlidersHorizontal,
  Smile,
} from 'lucide-react'
import { SectionHeading } from '@/components/admin/SectionHeading'
import { requireUser } from '@/lib/auth'
import { can } from '@/lib/permissions'

/**
 * Settings index (§3).
 *
 * Everything management may reasonably want to change lives behind one of these
 * links, and nothing here needs a developer.
 */
const SECTIONS = [
  {
    href: '/admin/settings/content',
    icon: MessageSquareText,
    title: 'Kiosk content',
    description: 'Every word the guest reads, with a live preview of the screen.',
  },
  {
    href: '/admin/settings/categories',
    icon: ListOrdered,
    title: 'Categories, issues and themes',
    description: 'What guests rate, the chips they can pick, and the comment lexicon.',
  },
  {
    href: '/admin/settings/rating-scale',
    icon: Smile,
    title: 'Rating scale',
    description: 'The five faces, their labels and their colours.',
  },
  {
    href: '/admin/settings/branding',
    icon: Palette,
    title: 'Branding',
    description: 'Café name, website and social links shown in the kiosk footer.',
  },
  {
    href: '/admin/settings/contact',
    icon: Phone,
    title: 'Grievance officer',
    description: 'The name, number and email a guest can reach.',
  },
  {
    href: '/admin/settings/system',
    icon: SlidersHorizontal,
    title: 'Thresholds, alerts and privacy',
    description: 'When the dashboard raises a flag, and how long data is kept.',
  },
]

export default async function SettingsIndexPage() {
  const user = await requireUser('/admin/settings')
  if (!can(user, 'manage:cms')) redirect('/admin')

  return (
    <div className="max-w-3xl space-y-4">
      <SectionHeading
        title="Settings"
        note="Anything here can be changed without a developer or a redeploy."
      />

      <ul className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className="border-line bg-surface hover:border-accent/50 block h-full rounded-xl border p-4"
            >
              <span className="flex items-center gap-2">
                <section.icon size={15} strokeWidth={1.8} className="text-accent" aria-hidden />
                <span className="text-ink text-sm font-semibold">{section.title}</span>
              </span>
              <span className="text-ink-muted mt-1.5 block text-xs">{section.description}</span>
              <span className="text-accent mt-2 inline-flex items-center gap-1 text-xs font-semibold">
                Open
                <ArrowRight size={12} strokeWidth={2.4} aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
