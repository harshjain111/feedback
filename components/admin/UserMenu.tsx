'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Role } from '@/lib/permissions'

export function UserMenu({ name, email, role }: { name: string; email: string; role: Role }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const signOut = async () => {
    setBusy(true)
    await createClient().auth.signOut()
    router.replace('/admin/login')
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right leading-tight">
        <p className="text-ink text-sm font-medium">{name}</p>
        <p className="text-ink-muted text-xs">
          {role} · {email}
        </p>
      </div>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        title="Sign out"
        aria-label="Sign out"
        className="border-line text-ink-soft hover:bg-ground-sunk rounded-lg border p-2 disabled:opacity-50"
      >
        <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>
  )
}
