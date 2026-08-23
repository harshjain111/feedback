export function SectionHeading({
  title,
  note,
  action,
}: {
  title: string
  note?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-ink text-xs font-semibold tracking-[0.14em] uppercase">{title}</h2>
        {note ? <p className="text-ink-muted mt-1 text-xs">{note}</p> : null}
      </div>
      {action}
    </div>
  )
}
