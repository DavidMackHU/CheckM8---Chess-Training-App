import { useSlowRequests } from '../lib/slowRequests.ts'

/** A notice shown while the API is slow to answer, usually because it is waking up. */
export default function ServerWaking() {
  const slow = useSlowRequests()
  if (!slow) return null
  return (
    <div
      role="status"
      data-testid="server-waking"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4"
    >
      <p className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/95 px-4 py-3 text-sm text-slate-200 shadow-lg">
        <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
        The server is waking up. The first load can take up to a minute.
      </p>
    </div>
  )
}
