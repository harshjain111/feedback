'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BigButton } from './BigButton'
import { CategoryIcon } from './CategoryIcon'
import { FaceScale } from './FaceScale'
import type { Category, RatingFace } from '@/lib/config.types'
import { getDraft, patchDraft } from '@/lib/session'

/**
 * Screen 02 — all four categories on ONE screen (§4).
 *
 * Deliberately not one page per category: the guest sees the whole ask up
 * front, which is both faster and more honest about what is being requested.
 * Each tap is written straight to the sessionStorage draft, so a mistap on
 * CONTINUE or an idle reset never loses more than the current journey.
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

  // Restore anything already answered — the guest may have stepped back.
  useEffect(() => {
    setRatings(getDraft().ratings)
    setHydrated(true)
  }, [])

  const setRating = (categoryId: string, value: number) => {
    // Merge onto the STORED ratings, not the closed-over state. Two taps in the
    // same tick (a guest running a finger down the screen) would otherwise each
    // build from the same stale object and the first one would be lost.
    const next = { ...getDraft().ratings, [categoryId]: value }
    patchDraft({ ratings: next })
    setRatings(next)
  }

  const complete =
    hydrated && categories.every((category) => typeof ratings[category.category_id] === 'number')

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col justify-evenly gap-6 px-12">
        {categories.map((category) => {
          const questionId = `question-${category.category_id}`
          return (
            <section key={category.category_id}>
              <div className="mb-5 flex items-center gap-4">
                <CategoryIcon name={category.icon} className="text-accent" size={38} />
                <div>
                  <h2 className="font-display text-k-h3 text-ink leading-none">{category.name}</h2>
                  <p id={questionId} className="text-k-small text-ink-muted mt-2">
                    {category.question}
                  </p>
                </div>
              </div>

              <FaceScale
                scale={scale}
                value={ratings[category.category_id] ?? null}
                onChange={(value) => setRating(category.category_id, value)}
                labelledBy={questionId}
                size={132}
              />
            </section>
          )
        })}
      </div>

      <div className="shrink-0 px-12 pt-6 pb-4">
        <BigButton
          fullWidth
          disabled={!complete}
          onClick={() => {
            // Prompt 11 replaces this with the §4 branch router.
            router.push('/comment')
          }}
        >
          {continueLabel}
        </BigButton>
      </div>
    </>
  )
}
