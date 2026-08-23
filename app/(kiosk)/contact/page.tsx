import { ContactForm } from '@/components/kiosk/ContactForm'
import { getConfig } from '@/lib/config'

/**
 * Name and mobile number (§5, §11).
 *
 * Both fields are optional and SKIP is always available. The consent line sits
 * in normal body text next to the fields, not in fine print at the bottom —
 * §11 requires it to be visible, and burying it would be the same as hiding it.
 */
export default async function KioskContactPage() {
  const config = await getConfig()

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <ContactForm copy={config.contact} consentText={config.privacy.consent_text} />
    </section>
  )
}
