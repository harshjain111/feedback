import { cn } from '@/lib/cn'

/**
 * The heading above a block, and — with `level="page"` — above a page.
 *
 * Two sizes rather than a free-form className: the admin previously had five
 * different heading treatments across seven pages, and that inconsistency is
 * most of what made it read as unfinished. A page title is the display serif,
 * a section title is the UI sans. Nothing else.
 */
export function SectionHeading({
  title,
  note,
  action,
  level = 'section',
}: {
  title: string
  note?: string
  action?: React.ReactNode
  level?: 'page' | 'section'
}) {
  const page = level === 'page'

  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', page ? 'mb-5' : 'mb-3')}>
      <div className="min-w-0">
        {page ? (
          <h1 className="font-display text-ink text-3xl">{title}</h1>
        ) : (
          <h2 className="text-ink text-lg font-semibold">{title}</h2>
        )}
        {note ? (
          <p className={cn('text-ink-muted', page ? 'mt-1 text-sm' : 'mt-0.5 text-sm')}>{note}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}
