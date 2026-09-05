'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, ChevronDown, MessageSquare, PhoneCall } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import type { FeedbackListItem, Paged } from '@/lib/queries/types'
import type { RatingFace } from '@/lib/config.types'
import { cn } from '@/lib/cn'

/**
 * The feedback list (§29).
 *
 * Rebuilt around one question: what does a manager actually do here? They scan
 * for the bad ones, then read the bad one. The old table answered neither well —
 * eight columns of equal weight, per-category scores as unlabelled coloured dots
 * that you had to hover to decode, and the comment clipped to an excerpt with
 * the rest only reachable through a page load.
 *
 * So: one row per feedback, scannable at a glance, and CLICK TO EXPAND for the
 * whole thing in place. Opening a row is instant because everything it shows is
 * already loaded — the list query returns full ratings, issues and comment
 * excerpt, and the only thing a detail page adds is the follow-up thread.
 *
 * Every rating carries its category name. A colour tells you something is wrong;
 * only a label tells you what.
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
  const [openId, setOpenId] = useState<string | null>(null)

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
    <div className="space-y-3">
      <ul className="border-line bg-surface divide-line divide-y overflow-hidden rounded-2xl border">
        {page.items.map((item) => {
          const open = openId === item.feedbackId
          const negative = item.sentiment === 'negative'

          return (
            <li key={item.feedbackId}>
              {/*
                The whole row is the control. A manager scanning a list should
                not have to find a chevron — but the chevron stays as the visual
                promise that there is more underneath.
              */}
              <button
                type="button"
                onClick={() => setOpenId(open ? null : item.feedbackId)}
                aria-expanded={open}
                className={cn(
                  'hover:bg-ground-sunk/60 flex w-full items-center gap-4 px-4 py-3 text-left transition-colors',
                  open && 'bg-ground-sunk/50',
                )}
              >
                {/* The score, as the thing the eye lands on first. */}
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[15px] font-semibold text-white tabular-nums"
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
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-ink text-[15px] font-medium">
                      {item.guestName ?? 'Anonymous'}
                    </span>
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

                  {/* One line of the comment, or the issues if there is none. */}
                  {item.comment ? (
                    <span className="text-ink-soft mt-0.5 flex items-start gap-1.5 text-sm">
                      <MessageSquare
                        size={13}
                        strokeWidth={2}
                        aria-hidden="true"
                        className="text-ink-muted mt-1 shrink-0"
                      />
                      <span className="line-clamp-1">{item.comment}</span>
                    </span>
                  ) : item.issues.length > 0 ? (
                    <span className="text-ink-muted mt-0.5 block truncate text-sm">
                      {item.issues.join(' · ')}
                    </span>
                  ) : null}
                </span>

                {/*
                  Per-category scores WITH their names. Hidden on narrow screens
                  rather than squeezed — they are in the expanded panel, which is
                  where a phone-sized reader will look anyway.
                */}
                <span className="hidden shrink-0 items-center gap-2 lg:flex">
                  {item.ratings.map((rating) => (
                    <RatingChip
                      key={rating.categoryId}
                      name={rating.name}
                      rating={rating.rating}
                      colour={colourFor(rating.rating)}
                    />
                  ))}
                </span>

                <StatusBadge status={item.status} className="shrink-0" />

                <ChevronDown
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                  className={cn(
                    'text-ink-muted shrink-0 transition-transform',
                    open && 'rotate-180',
                  )}
                />
              </button>

              {open ? (
                <div
                  className="border-line bg-ground-sunk/30 border-t px-4 py-4"
                  style={{ paddingLeft: 'calc(1rem + 2.75rem + 1rem)' }}
                >
                  <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
                    <div className="min-w-0 space-y-4">
                      {/* The whole comment. This is what the page is for. */}
                      {item.comment ? (
                        <div>
                          <p className="text-ink-muted text-xs font-medium tracking-wide uppercase">
                            What they said
                          </p>
                          <p className="text-ink mt-1.5 text-[15px] leading-relaxed whitespace-pre-wrap">
                            {item.comment}
                          </p>
                        </div>
                      ) : (
                        <p className="text-ink-muted text-sm">No comment was left.</p>
                      )}

                      {item.issues.length > 0 ? (
                        <div>
                          <p className="text-ink-muted text-xs font-medium tracking-wide uppercase">
                            {negative ? 'What went wrong' : 'What they loved'}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {item.issues.map((issue) => (
                              <span
                                key={issue}
                                className="border-line text-ink-soft rounded-full border px-2.5 py-1 text-xs"
                              >
                                {issue}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Repeated here because the row hides them under lg. */}
                      <div className="lg:hidden">
                        <p className="text-ink-muted text-xs font-medium tracking-wide uppercase">
                          Ratings
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {item.ratings.map((rating) => (
                            <RatingChip
                              key={rating.categoryId}
                              name={rating.name}
                              rating={rating.rating}
                              colour={colourFor(rating.rating)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="text-ink-muted space-y-2 text-xs lg:w-56">
                      <p>
                        <span className="text-ink-soft font-medium">{item.feedbackCode}</span>
                      </p>
                      {item.guestPhoneMasked ? <p>{item.guestPhoneMasked}</p> : null}
                      <Link
                        href={`/admin/feedback/${item.feedbackId}?${searchParams}`}
                        className="text-accent hover:text-accent-hover inline-flex items-center gap-1.5 text-sm font-semibold"
                      >
                        Open and follow up
                        <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
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
