import { cn } from '@/lib/cn'

/**
 * The one card shell every admin block sits in.
 *
 * There was previously a different border radius, padding and heading size on
 * almost every section, which is what made the page read as busy even when the
 * content was fine. One shell, one radius, one heading treatment — the variety
 * on a dashboard should come from the data, not from the boxes.
 */
export function Panel({
  title,
  note,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  note?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('border-line bg-surface rounded-2xl border', className)}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h2 className="text-ink text-base font-semibold">{title}</h2>
            {note ? <p className="text-ink-muted mt-0.5 text-sm">{note}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cn(title ? 'px-5 pb-5' : 'p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

/** What a panel shows when there is nothing to show. Never a blank box. */
export function PanelEmpty({ message }: { message: string }) {
  return (
    <p className="border-line text-ink-muted rounded-2xl border border-dashed px-4 py-6 text-center text-sm">
      {message}
    </p>
  )
}
