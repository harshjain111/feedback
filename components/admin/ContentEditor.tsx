'use client'

import { useState } from 'react'
import { ConfigField } from './ConfigField'
import { KioskPreview } from './KioskPreview'
import type { AppConfig } from '@/lib/config.types'
import { cn } from '@/lib/cn'

/**
 * The content CMS (§3, Prompt 35).
 *
 * Grouped by screen, with a live portrait preview beside the fields, because
 * the question a manager actually has is "what will the guest see" — and on a
 * 1080×1920 screen a three-word change can turn a heading into three lines.
 *
 * Editing here is the ONLY sanctioned way to change the §5 copy. The wording
 * shipped in 0002_seed.sql is what the client approved, which is why every
 * field keeps a one-click Reset.
 */

type Screen = {
  id: 'welcome' | 'rate' | 'negative' | 'positive' | 'comment' | 'followup' | 'contact' | 'thanks'
  label: string
  fields: { key: string; label: string; type?: 'text' | 'textarea' }[]
  note?: string
}

const SCREENS: Screen[] = [
  {
    id: 'welcome',
    label: 'Welcome',
    fields: [
      { key: 'welcome.h1', label: 'Headline' },
      { key: 'welcome.h2', label: 'Subheading' },
      { key: 'welcome.support', label: 'Supporting line', type: 'textarea' },
      { key: 'welcome.cta', label: 'Button' },
      { key: 'welcome.micro', label: 'Micro copy' },
    ],
    note: 'Never ask for personal information on this screen — it is about agency, not data collection.',
  },
  {
    id: 'rate',
    label: 'Rate',
    fields: [
      { key: 'rate.h1', label: 'Headline' },
      { key: 'rate.sub', label: 'Subheading', type: 'textarea' },
      { key: 'rate.cta', label: 'Button' },
    ],
    note: 'The subheading is load-bearing: it gives the guest explicit permission to criticise. Softening it costs you the honest ratings.',
  },
  {
    id: 'negative',
    label: 'Something went wrong',
    fields: [
      { key: 'negative.h1', label: 'Headline' },
      { key: 'negative.sub', label: 'Subheading', type: 'textarea' },
      { key: 'negative.h2', label: 'Chips heading' },
      { key: 'negative.h3', label: 'Comment heading' },
      { key: 'negative.support', label: 'Comment support', type: 'textarea' },
    ],
    note: 'Never defensive, never an apology wall. This screen moves the guest from anger to expression.',
  },
  {
    id: 'positive',
    label: 'That’s wonderful',
    fields: [
      { key: 'positive.h1', label: 'Headline' },
      { key: 'positive.sub', label: 'Subheading', type: 'textarea' },
      { key: 'positive.h2', label: 'Chips heading' },
    ],
  },
  {
    id: 'comment',
    label: 'General comment',
    fields: [
      { key: 'comment.h1', label: 'Headline' },
      { key: 'comment.support', label: 'Supporting line', type: 'textarea' },
      { key: 'comment.placeholder', label: 'Placeholder' },
      { key: 'comment.badge', label: 'Optional badge' },
    ],
  },
  {
    id: 'followup',
    label: 'Follow-up',
    fields: [
      { key: 'followup.h1', label: 'Headline' },
      { key: 'followup.support', label: 'Supporting line', type: 'textarea' },
      { key: 'followup.yes', label: 'Yes button' },
      { key: 'followup.no', label: 'No button' },
    ],
    note: 'Resolution, not escalation. The words "complaint", "lodge" and "manager" must not appear here.',
  },
  {
    id: 'contact',
    label: 'Contact',
    fields: [
      { key: 'contact.h1', label: 'Headline' },
      { key: 'contact.support', label: 'Subheading', type: 'textarea' },
      {
        key: 'contact.followup_sub',
        label: 'Subheading when follow-up was asked for',
        type: 'textarea',
      },
      { key: 'contact.name_label', label: 'Name label' },
      { key: 'contact.phone_label', label: 'Phone label' },
      { key: 'contact.phone_hint', label: 'Phone hint' },
      { key: 'contact.cta', label: 'Primary button' },
      { key: 'contact.skip', label: 'Skip button' },
      { key: 'contact.micro', label: 'Micro copy' },
      { key: 'contact.cta_hint', label: 'Micro copy while the button is dimmed' },
      { key: 'privacy.consent_text', label: 'Consent text', type: 'textarea' },
    ],
    note: 'Both fields are optional and SKIP is always available. The consent line must stay legible, not shrink into fine print.',
  },
  {
    id: 'thanks',
    label: 'Thank you',
    fields: [
      { key: 'thanks.h1', label: 'Headline' },
      { key: 'thanks.body', label: 'Body', type: 'textarea' },
      { key: 'thanks.line', label: 'Closing line' },
      { key: 'thanks.support', label: 'Supporting line' },
      { key: 'grievance.h1', label: 'Grievance heading' },
      { key: 'grievance.support', label: 'Grievance support' },
      { key: 'grievance.phone', label: 'Grievance phone' },
    ],
  },
]

/** Apply a dotted key to a copy of the config, for the preview. */
function withOverride(
  config: AppConfig,
  key: string,
  value: string | number | boolean | null,
): AppConfig {
  const [section, ...rest] = key.split('.')
  const leaf = rest.join('.')
  if (!section || !leaf) return config

  const clone = structuredClone(config) as unknown as Record<string, Record<string, unknown>>
  if (clone[section]) clone[section][leaf] = value
  return clone as unknown as AppConfig
}

export function ContentEditor({ config }: { config: AppConfig }) {
  const [active, setActive] = useState<Screen>(SCREENS[0]!)
  const [preview, setPreview] = useState<AppConfig>(config)

  return (
    <div className="space-y-4">
      <div className="border-line bg-surface flex flex-wrap gap-1.5 rounded-2xl border p-2">
        {SCREENS.map((screen) => (
          <button
            key={screen.id}
            type="button"
            onClick={() => setActive(screen)}
            aria-pressed={active.id === screen.id}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              active.id === screen.id
                ? 'bg-accent text-accent-ink'
                : 'text-ink-soft hover:bg-ground-sunk',
            )}
          >
            {screen.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="border-line bg-surface rounded-2xl border p-4">
          {active.note ? (
            <p className="bg-accent-soft text-accent mb-3 rounded-lg px-3 py-2 text-xs">
              {active.note}
            </p>
          ) : null}

          <div className="divide-line divide-y">
            {active.fields.map((field) => (
              <ConfigField
                key={field.key}
                configKey={field.key}
                label={field.label}
                type={field.type}
                value={readValue(config, field.key)}
                onLocalChange={(key, value) =>
                  setPreview((current) => withOverride(current, key, value))
                }
              />
            ))}
          </div>
        </div>

        <KioskPreview screen={active.id} config={preview} />
      </div>
    </div>
  )
}

function readValue(config: AppConfig, key: string): string {
  const [section, ...rest] = key.split('.')
  const group = (config as unknown as Record<string, Record<string, unknown>>)[section ?? '']
  const value = group?.[rest.join('.')]
  return value === null || value === undefined ? '' : String(value)
}
