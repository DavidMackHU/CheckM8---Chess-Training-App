import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { failed: boolean }

/**
 * Catches a crash while drawing a page, so the visitor sees a way out instead
 * of a blank screen. App gives it a `key` of the path, so moving to another
 * page starts fresh.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Page crashed:', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">Something went wrong on this page.</h1>
        <p className="text-slate-400">Your progress is saved. Reloading usually fixes it.</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-md bg-emerald-500 px-4 font-medium text-slate-950 hover:bg-emerald-400"
          >
            Reload
          </button>
          <a href="/" className="flex min-h-11 items-center rounded-md border border-slate-700 px-4 hover:border-slate-500">
            Home
          </a>
        </div>
      </main>
    )
  }
}
