import { redirect } from 'next/navigation'
import { KioskScreen } from '@/components/kiosk/KioskScreen'
import { MemoryFlow } from '@/components/kiosk/MemoryFlow'
import { getConfig } from '@/lib/config'

/**
 * The Memory Print Module — PHOTO_MODULE.md.
 *
 * Reached only after the feedback has committed (rule 1). The client-side guard
 * in MemoryFlow enforces that per journey; this server component enforces the
 * kill switch, which is a different thing and has to happen earlier.
 *
 * §8b layer 1: when `memory.enabled` is false the module must vanish. Not a
 * disabled button, not a "temporarily unavailable" card — a redirect, before any
 * client code that could ask for a camera is even sent to the browser. A guest
 * using a disabled kiosk should not be able to tell the feature exists.
 *
 * Config is re-read here on every journey rather than cached in client state,
 * which is what lets a manager's toggle land within seconds (§8b propagation).
 */
export default async function KioskMemoryPage() {
  const config = await getConfig()

  if (!config.memory.enabled) redirect('/thanks')

  return (
    <KioskScreen config={config} density="dense">
      <section className="flex min-h-0 flex-1 flex-col">
        <MemoryFlow copy={config.memory} />
      </section>
    </KioskScreen>
  )
}
