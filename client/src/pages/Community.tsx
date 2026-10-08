import { Link } from 'react-router'
import CourseCatalog from '../components/CourseCatalog.tsx'

/** /community: courses published by other players. */
export default function Community() {
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Community courses</h1>
          <p className="mt-1 text-slate-400">Repertoires built and shared by other players. Upvote the ones you like.</p>
        </div>
        <Link
          to="/creator/new"
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
        >
          Create your own
        </Link>
      </header>
      <CourseCatalog communityOnly />
    </main>
  )
}
