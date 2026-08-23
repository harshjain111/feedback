import { Globe, Instagram, Phone } from 'lucide-react'
import type { AppConfig } from '@/lib/config.types'

/**
 * The persistent footer (§5).
 *
 * `All India Café · Website · Instagram · Grievance Officer`, but shown the way
 * the reference does it: the actual handle and number rather than the words, so
 * a guest can read the number off the screen without tapping anything. Every
 * label and value still comes from config.
 */
export function KioskFooter({ config }: { config: AppConfig }) {
  const px = (n: number) => `calc(${n} * var(--kpx))`
  const iconSize = 18

  const items: { key: string; icon: typeof Globe; text: string; href: string | null }[] = [
    {
      key: 'website',
      icon: Globe,
      text: config.branding.website_url.replace(/^https?:\/\//, '') || config.footer.website_label,
      href: config.branding.website_url || null,
    },
    {
      key: 'instagram',
      icon: Instagram,
      text: config.branding.instagram_handle || config.footer.instagram_label,
      href: config.branding.instagram_url || null,
    },
    {
      key: 'grievance',
      icon: Phone,
      text: config.grievance.phone || config.footer.grievance_label,
      href: config.grievance.phone ? `tel:${config.grievance.phone.replace(/\s+/g, '')}` : null,
    },
  ]

  return (
    <footer
      className="border-line text-ink-muted shrink-0 border-t"
      style={{ paddingBlock: px(14), paddingInline: px(40) }}
    >
      <ul className="flex items-center justify-center" style={{ gap: px(40) }}>
        {items.map((item) => {
          const content = (
            <span className="inline-flex items-center" style={{ gap: px(8) }}>
              <item.icon
                size={iconSize}
                strokeWidth={1.8}
                aria-hidden="true"
                style={{ width: px(iconSize), height: px(iconSize) }}
              />
              <span className="text-k-micro">{item.text}</span>
            </span>
          )
          return <li key={item.key}>{item.href ? <a href={item.href}>{content}</a> : content}</li>
        })}
      </ul>
    </footer>
  )
}
