import { type EngineInfo, formatScore, whiteShare } from '../lib/chess/engine.ts'

type Props = {
  info: EngineInfo | null
  /** Which side is at the bottom of the board, so the bar matches it. */
  orientation: 'white' | 'black'
}

/** Vertical bar beside the board: the lighter part is White's share of the evaluation. */
export default function EngineEvalBar({ info, orientation }: Props) {
  const share = info ? whiteShare(info) : 50
  const label = info ? formatScore(info) : ''
  const whiteAhead = share >= 50

  return (
    <div
      data-testid="eval-bar"
      data-share={Math.round(share)}
      role="img"
      aria-label={info ? `Engine evaluation ${label}` : 'Engine evaluation not available yet'}
      className={`relative flex w-6 shrink-0 overflow-hidden rounded bg-slate-700 ${
        orientation === 'white' ? 'flex-col-reverse' : 'flex-col'
      }`}
    >
      <div className="bg-slate-100 transition-[height] duration-300" style={{ height: `${share}%` }} />
      {info && (
        <span
          className={`absolute inset-x-0 text-center text-[10px] font-semibold tabular-nums ${
            whiteAhead ? 'text-slate-900' : 'text-slate-100'
          } ${whiteAhead === (orientation === 'white') ? 'bottom-1' : 'top-1'}`}
        >
          {label.replace('+', '')}
        </span>
      )}
    </div>
  )
}
