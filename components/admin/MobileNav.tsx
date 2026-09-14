'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { NavLinks, SidebarBrand, SidebarFooter } from './Sidebar'
import type { Role } from '@/lib/permissions'

/**
 * The admin navigation on a phone.
 *
 * The sidebar is a fixed 240px column, which on a 390px screen left about 150px
 * for the actual page — every admin page overflowed its viewport by exactly
 * 336px. Below `lg` that column is hidden and this takes over: a button in the
 * header, and the same nav in a slide-over.
 *
 * It reuses NavLinks and SidebarFooter rather than restating them, so a new
 * section or a permission change cannot appear in one nav and not the other.
 */
export function MobileNav({ role, name, email }: { role: Role; name: string; email: string }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close on navigation. Without this the drawer stays open over the page the
  // user just asked for.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Escape closes it, and the page behind must not scroll while it is open.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        className="border-line text-ink-soft hover:bg-ground-sunk grid h-11 w-11 shrink-0 place-items-center rounded-xl border lg:hidden"
      >
        <Menu size={20} strokeWidth={2} aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop. Dismissal is also on Escape and on the labelled close
              button, so this carries no keyboard obligation of its own. */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Admin sections"
                  className="absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col shadow-2xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="flex items-start justify-between">
              <SidebarBrand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="m-3 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <NavLinks role={role} onNavigate={() => setOpen(false)} />
            </div>

            <SidebarFooter role={role} name={name} email={email} />
          </div>
        </div>
      ) : null}
    </>
  )
}
