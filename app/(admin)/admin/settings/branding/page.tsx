import { redirect } from 'next/navigation'
import { ConfigField } from '@/components/admin/ConfigField'
import { SectionHeading } from '@/components/admin/SectionHeading'
import { requireUser } from '@/lib/auth'
import { getConfig } from '@/lib/config'
import { can } from '@/lib/permissions'

/** Branding shown in the kiosk footer (§37). */
export default async function SettingsBrandingPage() {
  const user = await requireUser('/admin/settings/branding')
  if (!can(user, 'manage:cms')) redirect('/admin')

  const config = await getConfig()

  return (
    <div className="max-w-2xl space-y-4">
      <SectionHeading
        title="Branding"
        note="These feed the footer on every kiosk screen. An empty URL renders the label as plain text rather than a dead link."
      />

      <div className="border-line bg-surface divide-line divide-y rounded-2xl border p-4">
        <ConfigField configKey="branding.name" label="Café name" value={config.branding.name} />
        <ConfigField
          configKey="branding.website_url"
          label="Website URL"
          value={config.branding.website_url}
        />
        <ConfigField
          configKey="branding.instagram_url"
          label="Instagram URL"
          value={config.branding.instagram_url}
        />
        <ConfigField
          configKey="branding.instagram_handle"
          label="Instagram handle"
          value={config.branding.instagram_handle}
        />
        <ConfigField
          configKey="branding.logo_url"
          label="Logo URL"
          value={config.branding.logo_url}
          hint="Upload to Supabase Storage and paste the public URL. Left empty, the café name is used."
        />
      </div>

      <div className="border-line bg-surface divide-line divide-y rounded-2xl border p-4">
        <p className="text-ink-muted pb-2 text-xs">Footer labels</p>
        <ConfigField configKey="footer.brand" label="Brand" value={config.footer.brand} />
        <ConfigField
          configKey="footer.website_label"
          label="Website label"
          value={config.footer.website_label}
        />
        <ConfigField
          configKey="footer.instagram_label"
          label="Instagram label"
          value={config.footer.instagram_label}
        />
        <ConfigField
          configKey="footer.grievance_label"
          label="Grievance label"
          value={config.footer.grievance_label}
        />
      </div>
    </div>
  )
}
