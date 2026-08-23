import { redirect } from 'next/navigation'
import { ConfigField } from '@/components/admin/ConfigField'
import { SectionHeading } from '@/components/admin/SectionHeading'
import { requireUser } from '@/lib/auth'
import { getConfig } from '@/lib/config'
import { can } from '@/lib/permissions'

/**
 * Thresholds, alerts, rewards and privacy (§38).
 *
 * These decide when the dashboard raises its voice. Set them too tight and the
 * insight board cries wolf until people stop reading it; too loose and a bad
 * evening passes unnoticed. The defaults are a starting point, not an answer —
 * they should be tuned once there is a few weeks of real traffic.
 */
export default async function SettingsSystemPage() {
  const user = await requireUser('/admin/settings/system')
  if (!can(user, 'manage:cms')) redirect('/admin')

  const config = await getConfig()

  return (
    <div className="max-w-2xl space-y-6">
      <section>
        <SectionHeading
          title="Attention thresholds"
          note="What counts as a category needing attention, and how big a movement has to be before the dashboard mentions it."
        />
        <div className="border-line bg-surface divide-line divide-y rounded-2xl border p-4">
          <ConfigField
            configKey="thresholds.category_attention"
            label="Needs attention below"
            type="number"
            value={config.thresholds.category_attention}
            hint="A category scoring under this is flagged on the dashboard and in the category table."
          />
          <ConfigField
            configKey="thresholds.category_strong"
            label="Counts as strong at or above"
            type="number"
            value={config.thresholds.category_strong}
          />
          <ConfigField
            configKey="thresholds.category_drop_pct"
            label="Category drop (%)"
            type="number"
            value={config.thresholds.category_drop_pct}
            hint="A fall bigger than this against the previous period raises CATEGORY_DROP."
          />
          <ConfigField
            configKey="thresholds.issue_spike_pct"
            label="Issue spike (%)"
            type="number"
            value={config.thresholds.issue_spike_pct}
          />
          <ConfigField
            configKey="thresholds.theme_emerging_pct"
            label="Theme emerging (%)"
            type="number"
            value={config.thresholds.theme_emerging_pct}
          />
          <ConfigField
            configKey="thresholds.low_rating_cluster_count"
            label="Low-rating cluster size"
            type="number"
            value={config.thresholds.low_rating_cluster_count}
            hint="This many guests rating one category 1 or 2 in the period raises a critical insight."
          />
          <ConfigField
            configKey="thresholds.min_sample_size"
            label="Minimum sample size"
            type="number"
            value={config.thresholds.min_sample_size}
            hint="Nothing is claimed below this many ratings. Lowering it will make the dashboard louder and less reliable."
          />
        </div>
      </section>

      <section>
        <SectionHeading
          title="Alerts"
          note="Alerts fire as feedback arrives, so someone can act while the guest is still in the building."
        />
        <div className="border-line bg-surface divide-line divide-y rounded-2xl border p-4">
          <ConfigField
            configKey="alerts.rating_at_or_below"
            label="Alert on a rating at or below"
            type="number"
            value={config.alerts.rating_at_or_below}
          />
          <ConfigField
            configKey="alerts.on_follow_up_requested"
            label="Alert when a guest asks to be contacted"
            type="boolean"
            value={config.alerts.on_follow_up_requested}
          />
          <ConfigField
            configKey="alerts.cluster_count"
            label="Cluster: number of low ratings"
            type="number"
            value={config.alerts.cluster_count}
          />
          <ConfigField
            configKey="alerts.cluster_window_minutes"
            label="Cluster: within this many minutes"
            type="number"
            value={config.alerts.cluster_window_minutes}
          />
          <ConfigField
            configKey="alerts.complaint_spike_pct"
            label="Complaint spike (%)"
            type="number"
            value={config.alerts.complaint_spike_pct}
          />
          <ConfigField
            configKey="alerts.cooldown_minutes"
            label="Cooldown (minutes)"
            type="number"
            value={config.alerts.cooldown_minutes}
            hint="The same condition will not raise a second alert inside this window. Acknowledging one lets it fire again immediately."
          />
        </div>
      </section>

      <section>
        <SectionHeading
          title="Privacy"
          note="Phone numbers are optional for the guest and masked everywhere except a deliberate, logged reveal."
        />
        <div className="border-line bg-surface divide-line divide-y rounded-2xl border p-4">
          <ConfigField
            configKey="privacy.consent_text"
            label="Consent text"
            type="textarea"
            value={config.privacy.consent_text}
            hint="Shown next to the fields on the contact screen, in ordinary body text."
          />
          <ConfigField
            configKey="privacy.retention_days"
            label="Retention (days)"
            type="number"
            value={config.privacy.retention_days}
            hint="Empty means keep indefinitely. Set a number and the purge job removes guest contact details older than that."
          />
          <ConfigField
            configKey="privacy.mask_visible_digits"
            label="Visible digits when masked"
            type="number"
            value={config.privacy.mask_visible_digits}
          />
        </div>
      </section>

      <section>
        <SectionHeading
          title="Wallet reward"
          note="Out of scope for Phase 1 and shipped off. The journey already has the branch point, so switching this on later needs no change to the feedback flow."
        />
        <div className="border-line bg-surface divide-line divide-y rounded-2xl border p-4">
          <ConfigField
            configKey="rewards.enabled"
            label="Rewards enabled"
            type="boolean"
            value={config.rewards.enabled}
            hint="Phase 1 ships this off. Turning it on has no visible effect until the reward screen is built."
          />
          <ConfigField
            configKey="rewards.amount"
            label="Reward amount"
            type="number"
            value={config.rewards.amount}
          />
          <ConfigField
            configKey="rewards.wallet_provider"
            label="Wallet provider"
            value={config.rewards.wallet_provider}
          />
        </div>
      </section>
    </div>
  )
}
