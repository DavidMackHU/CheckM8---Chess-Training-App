type Props = {
  /** Moves in SAN, in order, starting from White's first move. */
  moves: string[]
}

/** Numbered list of moves: "1. e4 e5  2. Nf3 ...". The latest move is highlighted. */
export default function MoveList({ moves }: Props) {
  if (moves.length === 0) {
    return <p className="text-sm text-slate-500">No moves yet.</p>
  }

  const rows: { number: number; white: string; black?: string }[] = []
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ number: i / 2 + 1, white: moves[i], black: moves[i + 1] })
  }
  const lastIndex = moves.length - 1

  return (
    <ol data-testid="move-list" className="grid grid-cols-[2rem_1fr_1fr] gap-x-2 gap-y-1 font-mono text-sm">
      {rows.map((row, r) => (
        <li key={row.number} className="contents">
          <span className="text-slate-500">{row.number}.</span>
          <span className={r * 2 === lastIndex ? 'font-bold text-emerald-400' : ''}>{row.white}</span>
          <span className={r * 2 + 1 === lastIndex ? 'font-bold text-emerald-400' : ''}>{row.black ?? ''}</span>
        </li>
      ))}
    </ol>
  )
}
