'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Email + password sign-in.
 *
 * The error message is deliberately the same for a wrong password and an
 * unknown address: telling an attacker which emails exist is a free gift.
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        setError('That email and password did not match.')
        return
      }

      router.replace(next)
      router.refresh()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block">
        <span className="text-ink-soft mb-1.5 block text-sm font-medium">Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          className="border-line-strong focus:border-accent w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
        />
      </label>

      <label className="block">
        <span className="text-ink-soft mb-1.5 block text-sm font-medium">Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
          className="border-line-strong focus:border-accent w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-bad)]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="bg-accent text-accent-ink hover:bg-accent-hover w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
