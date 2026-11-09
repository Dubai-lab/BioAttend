import { useEffect, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { cn } from '@/lib/utils'

/**
 * Shell for the public pages: landing, privacy and terms.
 *
 * Kept separate from ConsoleLayout on purpose — nothing here needs a session,
 * and nothing here may read from the database.
 */
export function PublicLayout({ children }: { children: ReactNode }) {
  const { pathname, hash } = useLocation()

  // A route change keeps the old scroll position unless told otherwise, which
  // drops a reader into the middle of the privacy policy.
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView()
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash])

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-white">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  )
}

function PublicHeader() {
  const links = [
    { to: '/#how-it-works', label: 'How it works' },
    { to: '/#features', label: 'Features' },
    { to: '/#privacy', label: 'Data protection' },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-shell-950/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="BioAttend home">
          <Logo tone="light" size="sm" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm text-slate-300 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          to="/sign-in"
          className="inline-flex items-center gap-1.5 rounded-control bg-brand-500 px-3.5 py-2
                     text-sm font-medium text-white transition-colors hover:bg-brand-400 shrink-0"
        >
          <span className="sm:hidden">Sign in</span>
          <span className="hidden sm:inline">Staff console sign-in</span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </header>
  )
}

function PublicFooter() {
  const year = new Date().getFullYear()

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn('transition-colors hover:text-white', isActive && 'text-white')

  return (
    <footer className="bg-shell-950 text-slate-400">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed">
            Biometric staff attendance and shift management for Northcrest
            General Hospital. Built to record who was on duty, accurately and
            with the consent of every person enrolled.
          </p>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
            System
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link to="/#how-it-works" className="transition-colors hover:text-white">
                How it works
              </Link>
            </li>
            <li>
              <Link to="/#features" className="transition-colors hover:text-white">
                Features
              </Link>
            </li>
            <li>
              <Link to="/sign-in" className="transition-colors hover:text-white">
                Console sign-in
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
            Legal
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <NavLink to="/privacy" className={linkClass}>
                Privacy policy
              </NavLink>
            </li>
            <li>
              <Link to="/privacy#biometric-data" className="transition-colors hover:text-white">
                Biometric data notice
              </Link>
            </li>
            <li>
              <NavLink to="/terms" className={linkClass}>
                Terms of use
              </NavLink>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {year} Northcrest General Hospital. All rights reserved.</p>
          <p>Biometric data is processed under Rwanda Law No. 058/2021.</p>
        </div>
      </div>
    </footer>
  )
}
