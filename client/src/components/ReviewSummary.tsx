import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { DrillResult } from '../lib/train.ts'

type Props = {
  title: string
  lineName: string
  moveCount: number
  result: DrillResult
  /** Final position of the line. When given, a link opens it on the analysis board. */
  analysisFen?: string
  /** Buttons or links for what to do next. */
  children: ReactNode
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-center">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  )
}

/** Shown when a line ends: how it went and what to do next. */
export default function ReviewSummary({ title, lineName, moveCount, result, analysisFen, children }: Props) {
  const seconds = Math.max(1, Math.round(result.ms / 1000))
  return (
    <section
      data-testid="line-summary"
      className="mx-auto flex max-w-md flex-col items-center gap-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center"
    >
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-slate-400">{lineName}</p>
      <div className="grid w-full grid-cols-3 gap-3">
        <Stat label="moves" value={String(moveCount)} />
        <Stat label={result.mistakes === 1 ? 'mistake' : 'mistakes'} value={String(result.mistakes)} />
        <Stat label="seconds" value={String(seconds)} />
      </div>
      <p className="text-sm text-slate-400">
        {result.mistakes === 0 ? 'Clean run. Nicely done.' : 'You got there. It will be easier next time.'}
      </p>
      <div className="flex flex-wrap justify-center gap-3">{children}</div>
      {analysisFen && (
        <Link
          to={`/analysis?fen=${encodeURIComponent(analysisFen)}`}
          data-testid="open-analysis"
          className="text-sm text-slate-400 underline hover:text-slate-200"
        >
          Open this position in analysis
        </Link>
      )}
    </section>
  )
}
