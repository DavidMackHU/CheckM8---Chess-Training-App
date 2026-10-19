import { useState } from 'react'
import { NavLink } from 'react-router'
import { useCurrentUser, useLogout } from '../lib/auth.ts'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2.5 md:p-0 ${isActive ? 'text-white' : 'text-slate-300 hover:text-white'}`

/**
 * Desktop: one row of links. Phones: the links fold into a menu that opens
 * below the bar, with large tap targets. Following a link closes it.
 */
export default function Navbar() {
  const { data: user, isPending } = useCurrentUser()
  const logout = useLogout()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <header className="border-b border-slate-800">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 px-4 py-3" aria-label="Main">
        <NavLink to="/" onClick={close} className="text-lg font-bold tracking-tight">
          OpeningDrill
        </NavLink>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="nav-links"
          className="min-h-11 rounded-md border border-slate-700 px-3 text-sm md:hidden"
        >
          {open ? 'Close' : 'Menu'}
        </button>

        <div
          id="nav-links"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a')) close()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
          }}
          className={`${open ? 'flex' : 'hidden'} w-full flex-col gap-1 pt-3 text-base md:flex md:w-auto md:flex-row md:flex-wrap md:items-center md:gap-x-4 md:gap-y-2 md:pt-0 md:text-sm`}
        >
          <NavLink to="/openings" className={linkClass}>
            Openings
          </NavLink>
          <NavLink to="/community" className={linkClass}>
            Community
          </NavLink>
          <NavLink to="/analysis" className={linkClass}>
            Analysis
          </NavLink>
          <NavLink to="/leaderboards" className={linkClass}>
            Leaderboards
          </NavLink>
          {isPending ? null : user ? (
            <>
              <NavLink to="/dashboard" className={linkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/train/review" className={linkClass}>
                Review
              </NavLink>
              <NavLink to="/creator/new" className={linkClass}>
                Create
              </NavLink>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-800 px-3 pt-3 md:mt-0 md:border-0 md:p-0">
                <span data-testid="nav-username" className="max-w-40 truncate text-slate-300 md:max-w-32">
                  {user.username}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    close()
                    logout.mutate()
                  }}
                  disabled={logout.isPending}
                  className="min-h-11 rounded-md border border-slate-700 px-3 hover:border-slate-500 md:min-h-0 md:py-1.5"
                >
                  Log out
                </button>
              </div>
            </>
          ) : (
            <div className="mt-2 flex items-center gap-3 border-t border-slate-800 px-3 pt-3 md:mt-0 md:border-0 md:p-0">
              <NavLink to="/login" className="flex min-h-11 items-center text-slate-300 hover:text-white md:min-h-0">
                Log in
              </NavLink>
              <NavLink
                to="/signup"
                className="flex min-h-11 items-center rounded-md bg-emerald-500 px-4 font-medium text-slate-950 hover:bg-emerald-400 md:min-h-0 md:px-3 md:py-1.5"
              >
                Sign up
              </NavLink>
            </div>
          )}
        </div>
      </nav>
    </header>
  )
}
