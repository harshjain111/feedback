import type { AppConfig } from '@/lib/config.types'

/**
 * The persistent footer, on every kiosk screen (§5).
 *
 * `All India Café · Website · Instagram · Grievance Officer` — every label, URL
 * and phone number comes from config. Nothing here is typed into the component.
 */
export function KioskFooter({ config }: { config: AppConfig }) {
  const items: { label: string; href: string | null }[] = [
    { label: config.footer.brand, href: null },
    { label: config.footer.website_label, href: config.branding.website_url || null },
    { label: config.footer.instagram_label, href: config.branding.instagram_url || null },
    {
      label: config.footer.grievance_label,
      href: config.grievance.phone ? `tel:${config.grievance.phone.replace(/\s+/g, '')}` : null,
    },
  ]

  return (
    <footer className="border-line shrink-0 border-t px-12 py-6">
      <ul className="text-ink-muted flex items-center justify-center gap-4 text-center">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-4">
            {index > 0 ? <span aria-hidden="true">·</span> : null}
            {item.href ? (
              <a href={item.href} className="text-k-micro underline-offset-4 hover:underline">
                {item.label}
              </a>
            ) : (
              <span className="text-k-micro">{item.label}</span>
            )}
          </li>
        ))}
      </ul>
    </footer>
  )
}
