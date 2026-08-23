import { redirect } from 'next/navigation'
import { ConfigField } from '@/components/admin/ConfigField'
import { SectionHeading } from '@/components/admin/SectionHeading'
import { requireUser } from '@/lib/auth'
import { getConfig } from '@/lib/config'
import { can } from '@/lib/permissions'

/**
 * The grievance officer (§37, §5).
 *
 * This number is on the thank-you screen as a tel: link, so it is the one a
 * guest taps when a feedback form is not enough. It has to be a real, answered
 * number.
 */
export default async function SettingsContactPage() {
  const user = await requireUser('/admin/settings/contact')
  if (!can(user, 'manage:cms')) redirect('/admin')

  const config = await getConfig()
  const placeholder = config.grievance.phone.replace(/[^\d]/g, '') === '910000000000'

  return (
    <div className="max-w-2xl space-y-4">
      <SectionHeading
        title="Grievance officer"
        note="Shown at the bottom of the thank-you screen, and in the footer of every screen."
      />

      {placeholder ? (
        <p className="rounded-lg bg-[color:var(--color-warn)]/12 px-3 py-2 text-xs text-[color:var(--color-warn)]">
          This is still the seeded placeholder number. Replace it before the kiosk goes live — a
          guest who taps it today reaches nobody.
        </p>
      ) : null}

      <div className="border-line bg-surface divide-line divide-y rounded-2xl border p-4">
        <ConfigField configKey="grievance.name" label="Name" value={config.grievance.name} />
        <ConfigField
          configKey="grievance.phone"
          label="Phone"
          value={config.grievance.phone}
          hint="Rendered as a tel: link, so it must be dialable exactly as written."
        />
        <ConfigField configKey="grievance.email" label="Email" value={config.grievance.email} />
        <ConfigField configKey="grievance.h1" label="Heading" value={config.grievance.h1} />
        <ConfigField
          configKey="grievance.support"
          label="Supporting line"
          value={config.grievance.support}
        />
      </div>
    </div>
  )
}
