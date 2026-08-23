'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BigButton } from './BigButton'
import { CategoryIcon } from './CategoryIcon'
import { FaceScale } from './FaceScale'
import { PrefetchNext } from './PrefetchNext'
import type { Category, RatingFace } from '@/lib/config.types'
import { ratingValues, routeAfterRating } from '@/lib/journey'
import { getDraft, patchDraft } from '@/lib/session'
import { cn } from '@/lib/cn'

/**
 * Screen 02 — all four categories on ONE screen (§4).
 *
 * Each category is its own card: icon, name, question, then the faces. The card
 * is what makes four separate questions readable as four separate questions
 * rather than a wall of twenty circles.
 *
 * Deliberately not one page per category — the guest sees the whole ask up
 * front, which is both faster and more honest about what is being requested.
 */
export function RateForm({
  categories,
  scale,
  continueLabel,
}: {
  categories: Category[]
  scale: RatingFace[]
  continueLabel: string
}) {
  const router = useRouter()
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [hydrated, setHydrated] = useState(false)
  const px = (n: number) => `calc(${n} * var(--kpx))`

  useEffect(() => {
    setRatings(getDraft().ratings)
    setHydrated(true)
  }, [])

  const setRating = (categoryId: string, value: number) => {
    // Merge onto the STORED ratings, not the closed-over state. Two taps in the
    // same tick would otherwise each build from the same stale object.
    const next = { ...getDraft().ratings, [categoryId]: value }
    patchDraft({ ratings: next })
    setRatings(next)
  }

  const complete =
    hydrated && categories.every((category) => typeof ratings[category.category_id] === 'number')

  return (
    <>
      {/* Any of the three branches could be next; prefetch is cheap and the
          tablet is idle while the guest is still deciding. */}
      <PrefetchNext routes={['/issues', '/loved', '/comment']} />

      <div
        className="flex min-h-0 flex-1 flex-col justify-center"
        style={{ gap: px(14), paddingInline: px(36) }}
      >
        {categories.map((category) => {
          const questionId = `question-${category.category_id}`
          const answered = typeof ratings[category.category_id] === 'number'

          return (
            <section
              key={category.category_id}
              className={cn('k-card transition-colors duration-[--duration-kiosk]')}
              style={{
                padding: px(20),
                borderColor: answered ? 'var(--color-accent)' : undefined,
              }}
            >
              <div className="flex items-center" style={{ gap: px(14), marginBottom: px(14) }}>
                <span
                  className="text-accent bg-accent-soft grid shrink-0 place-items-center rounded-full"
                  style={{ width: px(52), height: px(52) }}
                >
                  <CategoryIcon name={category.icon} size={26} />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-k-h3 text-ink leading-none">{category.name}</h2>
                  <p
                    id={questionId}
                    className="text-k-small text-ink-muted"
                    style={{ marginTop: px(6) }}
                  >
                    {category.question}
                  </p>
                </div>
              </div>

              <FaceScale
                scale={scale}
                value={ratings[category.category_id] ?? null}
                onChange={(value) => setRating(category.category_id, value)}
                labelledBy={questionId}
                size={92}
              />
            </section>
          )
        })}
      </div>

      <div className="shrink-0" style={{ paddingInline: px(36), paddingBlock: px(20) }}>
        <BigButton
          fullWidth
          className="k-cta"
          disabled={!complete}
          onClick={() => router.push(routeAfterRating(ratingValues(ratings)))}
        >
          {continueLabel}
        </BigButton>
      </div>
    </>
  )
}
