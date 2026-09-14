import Link from 'next/link'
import { ChevronRight, MessageSquare, PhoneCall } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import type { FeedbackListItem, Paged } from '@/lib/queries/types'
import type { RatingFace } from '@/lib/config.types'

/**
 * The feedback list (§29).
 *
 * One row per submission, and THE WHOLE ROW IS A LINK to that feedback's
 * overview page. It briefly expanded in place instead; the client asked for
 * navigation, and they are right that it is the better default here — the
 * overview page is where the follow-up thread, the guest's history and the
 * actions live, and an inline panel could never hold those without becoming a
 * second, worse copy of the page.
 *
 * Rendered on the server. There is no client component in this file any more,
 * which also means none of it ships to the browser.
 *
 * The comment is shown in full-width wrapping text rather than clipped to a
 * single line. A feedback list where you cannot read the feedback is a table of
 * metadata.
 */
export function FeedbackTable({
  page,
  scale,
  searchParams,
}: {
  page: Paged<FeedbackListItem>
  scale: RatingFace[]
  searchParams: string
}) {
  const colourFor = (rating: number) =>
    scale.find((face) => face.value === rating)?.colour ?? 'var(--color-line-strong)'

  if (page.items.length === 0) {
    return (
      <div className="border-line text-ink-muted rounded-2xl border border-dashed p-10 text-center text-sm">
        No feedback matches these filters.
      </div>
    )
  }

  return (
    <ul className="border-line bg-surface divide-line divide-y overflow-hidden rounded-2xl border">
      {page.items.map((item) => (
        <li key={item.feedbackId}>
          <Link
            href={`/admin/feedback/${item.feedbackId}?${searchParams}`}
            className="hover:bg-ground-sunk/60 focus-visible:bg-ground-sunk/60 group flex w-full items-start gap-4 px-4 py-3.5 transition-colors"
          >
            {/* The score, as the thing the eye lands on first. */}
            <span
              className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full text-[15px] font-semibold text-white tabular-nums"
              style={{
                background:
                  item.overallScore === null
                    ? 'var(--color-line-strong)'
                    : colourFor(Math.round(item.overallScore)),
              }}
            >
              {item.overallScore === null ? '—' : item.overallScore.toFixed(1)}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="text-ink text-[15px] font-medium">
                  {item.guestName ?? 'Anonymous'}
                </span>
                {/*
                  The real number, not XXXXXX3210 (0021). The query returns null
                  here for STAFF, who fall back to the masked form.
                */}
                {(item.guestPhone ?? item.guestPhoneMasked) !== null ? (
                  <span className="text-ink-soft text-xs tabular-nums">
                    {item.guestPhone ?? item.guestPhoneMasked}
                  </span>
                ) : null}
                <span className="text-ink-muted text-xs tabular-nums">
                  {item.localDate} · {item.localTime.slice(0, 5)}
                </span>
                {item.followUpRequested ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium"
                    style={{ color: 'var(--color-terracotta)' }}
                  >
                    <PhoneCall size={12} strokeWidth={2.2} aria-hidden="true" />
                    Wants a call
                  </span>
                ) : null}
              </span>

              {/*
                The guest's words, wrapping across the full width of the row and
                clamped at three lines rather than one. Three lines carries a
                whole short complaint; one line carried "worst South Indian and…"
              */}
              {item.comment ? (
                <span className="text-ink-soft mt-1.5 flex items-start gap-1.5 text-sm leading-relaxed">
                  <MessageSquare
                    size={13}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="text-ink-muted mt-[5px] shrink-0"
                  />
                  <span className="line-clamp-3">{item.comment}</span>
                </span>
              ) : null}

              {/* Ratings, each with its category name — a colour says something
                  is wrong, only a label says which. */}
              <span className="mt-2 flex flex-wrap items-center gap-1.5">
                {item.ratings.map((rating) => (
                  <RatingChip
                    key={rating.categoryId}
                    name={rating.name}
                    rating={rating.rating}
                    colour={colourFor(rating.rating)}
                  />
                ))}
                {item.issues.map((issue) => (
                  <span
                    key={issue}
                    className="border-line text-ink-muted rounded-full border px-2.5 py-0.5 text-[11px]"
                  >
                    {issue}
                  </span>
                ))}
              </span>
            </span>

            <span className="mt-0.5 flex shrink-0 items-center gap-3">
              <StatusBadge status={item.status} />
              <ChevronRight
                size={16}
                strokeWidth={2}
                aria-hidden="true"
                className="text-ink-muted group-hover:text-ink-soft transition-colors"
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/**
 * One category score, always with its name.
 *
 * The old table showed bare coloured dots. Colour says "something here is bad";
 * only the label says WHICH, and a manager reading a 1 needs to know whether the
 * kitchen or the floor caused it before they can do anything about it.
 */
function RatingChip({
  name,
  rating,
  colour,
}: {
  name: string
  rating: number
  colour: string
}) {
  return (
    <span
      className="border-line inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5"
      title={`${name}: ${rating} of 5`}
    >
      <span
        className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold text-white tabular-nums"
        style={{ background: colour }}
        aria-hidden="true"
      >
        {rating}
      </span>
      <span className="text-ink-soft text-[11px] font-medium">
        {name}
        <span className="sr-only">: {rating} of 5</span>
      </span>
    </span>
  )
}
