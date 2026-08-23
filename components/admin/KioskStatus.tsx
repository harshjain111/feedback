import { Tablet } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Kiosk online/offline badge (§43).
 *
 * "No feedback today" and "the tablet has been off since Tuesday" look
 * identical on a dashboard and mean completely different things. This is the
 * difference.
 */
const STALE_AFTER_MINUTES = 10

export function KioskStatus({
  kiosks,
}: {
  kiosks: { label: string; lastSeenAt: string | null }[]
}) {
  if (kiosks.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2">
      {kiosks.map((kiosk) => {
        const minutesAgo =
          kiosk.lastSeenAt === null
            ? null
            : Math.round((Date.now() - new Date(kiosk.lastSeenAt).getTime()) / 60_000)
        const online = minutesAgo !== null && minutesAgo <= STALE_AFTER_MINUTES

        return (
          <li
            key={kiosk.label}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs',
              online
                ? 'border-[color:var(--color-good)]/40 text-[color:var(--color-good)]'
                : 'border-[color:var(--color-bad)]/40 text-[color:var(--color-bad)]',
            )}
            title={
              kiosk.lastSeenAt
                ? `Last heartbeat ${new Date(kiosk.lastSeenAt).toLocaleString()}`
                : 'This kiosk has never checked in.'
            }
          >
            <Tablet size={13} strokeWidth={2} aria-hidden="true" />
            {kiosk.label}
            <span className="font-medium">
              {online
                ? 'online'
                : minutesAgo === null
                  ? 'never seen'
                  : minutesAgo < 120
                    ? `offline ${minutesAgo}m`
                    : `offline ${Math.round(minutesAgo / 60)}h`}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
