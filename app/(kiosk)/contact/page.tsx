import { ContactForm } from '@/components/kiosk/ContactForm'
import { KioskScreen } from '@/components/kiosk/KioskScreen'
import { getConfig } from '@/lib/config'

/**
 * Name and mobile number (§5, §11).
 *
 * Both optional, SKIP always available. The consent line sits in normal body
 * text next to the fields — §11 requires it visible, and burying it in fine
 * print would be the same as hiding it.
 */
export default async function KioskContactPage() {
  const config = await getConfig()

  return (
    <KioskScreen config={config} density="dense">
      <section className="flex min-h-0 flex-1 flex-col">
        <ContactForm copy={config.contact} consentText={config.privacy.consent_text} />
      </section>
    </KioskScreen>
  )
}
