import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * A feedback or guest id that does not resolve.
 *
 * Both detail pages already call notFound() when the row is missing or RLS
 * hides it — but with no not-found boundary under /admin that landed on Next's
 * bare 404, outside the shell. A stale bookmark or a link to a purged record
 * (§11 retention) is an ordinary thing to hit, not an error, and it should
 * leave you inside the app.
 *
 * The copy deliberately names the likely causes rather than saying "not found":
 * whether a record was purged or is simply not yours to see changes what the
 * reader should do next.
 */
export default function AdminNotFound() {
  return (
    <div className="border-line bg-surface mx-auto max-w-lg rounded-2xl border p-6 text-center">
      <h1 className="font-display text-ink text-2xl">That record isn&rsquo;t here.</h1>
      <p className="text-ink-soft mt-2 text-sm">
        It may have been removed by the retention policy, or it may belong to an outlet this
        account cannot see. Either way the link will not start working again on its own.
      </p>

      <Link
        href="/admin/feedback"
        className="text-accent hover:text-accent-hover mt-5 inline-flex items-center gap-1.5 text-sm font-semibold"
      >
        <ArrowLeft size={15} strokeWidth={2.4} aria-hidden="true" />
        Back to feedback
      </Link>
    </div>
  )
}
