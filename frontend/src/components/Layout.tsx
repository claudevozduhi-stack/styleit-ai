// Общий каркас страниц: шапка с навигацией и область контента.
import { Shirt } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/measurements', label: 'Мерки' },
  { to: '/privacy', label: 'Приватность' },
] as const

/** Оборачивает страницу в единый каркас с навигацией. */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200 bg-white">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-semibold">
            <Shirt className="h-5 w-5 text-brand" aria-hidden />
            StyleIt AI
          </NavLink>
          <ul className="flex gap-4 text-sm">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    isActive ? 'font-medium text-brand' : 'text-neutral-600'
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}
