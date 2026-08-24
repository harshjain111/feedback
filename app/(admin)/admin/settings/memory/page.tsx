import { redirect } from 'next/navigation'
import { AlertTriangle, Info } from 'lucide-react'
import { ConfigField } from '@/components/admin/ConfigField'
import { Panel } from '@/components/admin/Panel'
import { SectionHeading } from '@/components/admin/SectionHeading'
import { requireUser } from '@/lib/auth'
import { getConfig } from '@/lib/config'
import { BLOCKED_LABELS, memorySwitch } from '@/lib/memory-switch'
import { can } from '@/lib/permissions'

/**
 * Settings → Memory prints (PHOTO_MODULE.md §8b, §9).
 *
 * Everything a manager can change about the keepsake, in the order they will
 * want it: the switch first, because that is what somebody opening this page
 * during a jam is looking for; then the copy; then the things that need a paper
 * roll and an evening to tune.
 *
 * The switch is ALSO on the device-health badge in the header, deliberately
 * duplicated: §8b is explicit that a manager with a jammed printer at 9pm
 * should not have to navigate here at all.
 */
export default async function SettingsMemoryPage() {
  const user = await requireUser('/admin/settings/memory')
  if (!can(user, 'manage:cms')) redirect('/admin')

  const config = await getConfig()
  const memory = config.memory
  const state = memorySwitch(memory)

  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeading
        title="Memory prints"
        note="The free keepsake photo, printed on the kiosk's thermal printer after feedback is saved."
        level="page"
      />

      {/* Non-negotiable #3, stated where somebody is about to change the copy. */}
      <p
        className="text-ink-soft flex items-start gap-3 rounded-2xl p-4 text-sm"
        style={{ background: 'var(--color-accent-soft)' }}
      >
        <Info size={18} strokeWidth={2} aria-hidden="true" className="text-accent mt-0.5 shrink-0" />
        <span>
          The keepsake is unconditional. It is never mentioned while a guest is rating, and a
          guest who rates 1/5 is offered exactly the same print as one who rates 5/5 — only the
          wording changes. Please keep that true when editing the copy below.
        </span>
      </p>

      {state.blockedBy !== null && state.blockedBy !== 'master' ? (
        <p
          className="flex items-start gap-3 rounded-2xl border p-4 text-sm"
          style={{
            borderColor: 'color-mix(in srgb, var(--color-warn) 45%, transparent)',
            color: 'var(--color-warn)',
          }}
        >
          <AlertTriangle size={18} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{BLOCKED_LABELS[state.blockedBy]}</span>
        </p>
      ) : null}

      <Panel
        title="The switch"
        note="Three independent layers. Any one of them being off means no prints."
      >
        <div className="divide-line divide-y">
          <ConfigField
            configKey="memory.enabled"
            label="Memory prints are on"
            type="boolean"
            value={memory.enabled}
            hint="Off removes the module from the guest journey entirely — no offer on the welcome screen, and the camera is never requested. A guest cannot tell the feature exists."
          />
          <ConfigField
            configKey="memory.auto_disable_on_failure"
            label="Switch off automatically after repeated print failures"
            type="boolean"
            value={memory.auto_disable_on_failure}
            hint="A jammed printer otherwise keeps offering a gift it cannot deliver, silently, to every guest. Turning back on is always manual."
          />
          <ConfigField
            configKey="memory.failure_threshold"
            label="Failures before switching off"
            type="number"
            value={memory.failure_threshold}
            hint="Consecutive failed prints. Three is a jam; one is a coincidence."
          />
          <ConfigField
            configKey="memory.schedule_enabled"
            label="Only run during scheduled hours"
            type="boolean"
            value={memory.schedule_enabled}
            hint="Off by default. Useful once you can see where the queue actually forms — for example evenings and weekends only."
          />
        </div>
      </Panel>

      <Panel title="The offer" note="What a guest sees after their feedback is saved.">
        <div className="divide-line divide-y">
          <ConfigField
            configKey="memory.offer_line_welcome"
            label="Line on the welcome screen"
            value={memory.offer_line_welcome}
            hint="The only place the keepsake is mentioned before the feedback is done — and it is never mentioned again until after."
          />
          <ConfigField
            configKey="memory.offer_heading"
            label="Offer heading"
            value={memory.offer_heading}
          />
          <ConfigField
            configKey="memory.offer_body"
            label="Offer body"
            type="textarea"
            value={memory.offer_body}
          />
          <ConfigField
            configKey="memory.privacy_line"
            label="Privacy line"
            type="textarea"
            value={memory.privacy_line}
            hint="Shown before the guest decides, not after. The photo genuinely never leaves the kiosk — please do not soften this into something vaguer than the truth."
          />
          <ConfigField configKey="memory.take_cta" label="Take-photo button" value={memory.take_cta} />
          <ConfigField configKey="memory.skip_cta" label="Skip button" value={memory.skip_cta} />
        </div>
      </Panel>

      <Panel
        title="After a difficult visit"
        note="Shown instead of the standard offer when the feedback was negative."
      >
        <div className="divide-line divide-y">
          <ConfigField
            configKey="memory.negative_offer_heading"
            label="Heading"
            value={memory.negative_offer_heading}
            hint="Sincere rather than upbeat. A guest who waited forty minutes for cold food does not want a cheerful 'smile!' — but they get exactly the same print."
          />
          <ConfigField
            configKey="memory.negative_offer_body"
            label="Body"
            type="textarea"
            value={memory.negative_offer_body}
          />
        </div>
      </Panel>

      <Panel title="Taking the photo">
        <div className="divide-line divide-y">
          <ConfigField
            configKey="memory.countdown_seconds"
            label="Countdown"
            type="number"
            value={memory.countdown_seconds}
            hint="Seconds. The screen also flashes near-white for the last of it — the panel is the only light source a café has at 9pm."
          />
          <ConfigField
            configKey="memory.max_retries"
            label="Retakes allowed"
            type="number"
            value={memory.max_retries}
            hint="After this the guest can only keep the photo. Without a cap one table can hold the kiosk through the whole exit rush."
          />
          <ConfigField
            configKey="memory.review_heading"
            label="Review heading"
            value={memory.review_heading}
          />
          <ConfigField configKey="memory.retry_cta" label="Retake button" value={memory.retry_cta} />
          <ConfigField configKey="memory.keep_cta" label="Print button" value={memory.keep_cta} />
          <ConfigField
            configKey="memory.printing_message"
            label="While printing"
            value={memory.printing_message}
          />
          <ConfigField
            configKey="memory.collect_message"
            label="Where to collect it"
            value={memory.collect_message}
            hint="Load-bearing. A guest who does not know a printer exists will walk away from a kiosk that is mid-print."
          />
        </div>
      </Panel>

      <Panel title="What is printed on the paper">
        <div className="divide-line divide-y">
          <ConfigField
            configKey="memory.caption_line"
            label="Caption"
            type="textarea"
            value={memory.caption_line}
            hint="Two lines at most; longer captions are wrapped and then trimmed."
          />
          <ConfigField
            configKey="memory.caption_line_negative"
            label="Caption after a difficult visit"
            type="textarea"
            value={memory.caption_line_negative}
          />
          <ConfigField
            configKey="memory.footer_line"
            label="Footer"
            value={memory.footer_line}
            hint="The date is added automatically, in Kolkata time."
          />
          <ConfigField
            configKey="memory.thermal_logo_url"
            label="Thermal logo"
            value={memory.thermal_logo_url}
            hint="A separate asset from the web logo, and it must be a hand-prepared 1-bit (pure black and white) bitmap. Auto-converting a vector or a greyscale logo will NOT work: at 203dpi every thin stroke and every gradient disappears and the print comes out a grey smear. Leave empty to print without a logo."
          />
        </div>
      </Panel>

      <Panel
        title="Image tuning"
        note="These live on the kiosk, in the print agent's config.json — not here."
      >
        <p className="text-ink-soft text-sm">
          Contrast, sharpening, gamma and the dither are tuned on the kiosk itself, against the
          café&rsquo;s real evening lighting and this printer&rsquo;s actual head. Changing them
          from a desk is guesswork. Run{' '}
          <code className="bg-ground-sunk rounded px-1.5 py-0.5 text-xs">pnpm pipeline:preview</code>{' '}
          on the kiosk with a few real photos and adjust{' '}
          <code className="bg-ground-sunk rounded px-1.5 py-0.5 text-xs">agent/config.json</code>;
          the agent README has the measured before-and-after numbers for each knob.
        </p>
      </Panel>
    </div>
  )
}
