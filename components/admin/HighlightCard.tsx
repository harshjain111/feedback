import Link from 'next/link'
import { ArrowRight, ThumbsDown, ThumbsUp } from 'lucide-react'
import { DeltaBadge } from './DeltaBadge'
import type { IssueCount } from '@/lib/queries/types'
import { cn } from '@/lib/cn'

/**
 * TODAY'S BIGGEST ISSUE / TODAY'S BIGGEST WIN (§32, block 3).
 *
 * Paired on purpose. A dashboard that only surfaces problems trains the owner
 * to dread opening it, and §22 is explicit that the product must show what the
 * café is doing well alongside what it is getting wrong.
 */
export function HighlightCard({
  kind,
  title,
  issue,
  href,
  emptyMessage,
}: {
  kind: 'issue' | 'win'
  title: string
  issue: IssueCount | null
  href: string
  emptyMessage: string
}) {
  const negative = kind === 'issue'
  const Icon = negative ? ThumbsDown : ThumbsUp

  return (
    <section
      className={cn(
        'bg-surface rounded-xl border p-4',
        negative ? 'border-[color:var(--color-bad)]/35' : 'border-[color:var(--color-good)]/35',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          size={14}
          strokeWidth={2}
          aria-hidden="true"
          className={negative ? 'text-[color:var(--color-bad)]' : 'text-[color:var(--color-good)]'}
        />
        <h3 className="text-ink-muted text-[11px] font-semibold tracking-[0.14em] uppercase">
          {title}
        </h3>
      </div>

      {issue ? (
        <>
          <p className="font-display text-ink mt-2 text-2xl">{issue.name}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <span className="text-ink-soft text-sm tabular-nums">
              {issue.mentions.value ?? 0} mentions
            </span>
            <DeltaBadge
              comparison={issue.mentions}
              polarity={negative ? 'lower-is-better' : 'higher-is-better'}
            />
          </div>
          <Link
            href={href}
            className="text-accent hover:text-accent-hover mt-3 inline-flex items-center gap-1 text-xs font-semibold"
          >
            VIEW FEEDBACK
            <ArrowRight size={13} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </>
      ) : (
        <p className="text-ink-muted mt-3 text-sm">{emptyMessage}</p>
      )}
    </section>
  )
}
