import { redirect } from 'next/navigation'
import { ContentEditor } from '@/components/admin/ContentEditor'
import { SectionHeading } from '@/components/admin/SectionHeading'
import { requireUser } from '@/lib/auth'
import { getConfig } from '@/lib/config'
import { can } from '@/lib/permissions'

/**
 * Kiosk content (§3, Prompt 35).
 *
 * Every customer-facing string, editable, with a live preview. Saving writes
 * app_config and an audit_log row and revalidates the config cache, so the
 * change reaches the tablet on its next render — no redeploy.
 */
export default async function SettingsContentPage() {
  const user = await requireUser('/admin/settings/content')
  if (!can(user, 'manage:cms')) redirect('/admin')

  const config = await getConfig()

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Kiosk content"
        note="Changes are saved as you leave each field and appear on the kiosk within a minute. Every field can be reset to the wording the client approved."
      />
      <ContentEditor config={config} />
    </div>
  )
}
