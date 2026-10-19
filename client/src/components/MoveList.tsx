type Props = {
  /** Moves played so far, in SAN, in order. */
  moves: string[]
  /** Moves after the current one that can be stepped forward to (analysis board). Shown dimmed. */
  future?: string[]
  /** Position the moves start from. Sets the first move number and whether Black moves first. */
  startFen?: string
}

type Cell = { san: string; index: number } | null

/** Numbered list of moves: "1. e4 e5  2. Nf3 ...". The latest move is highlighted. */
export default function MoveList({ moves, future = [], startFen }: Props) {
  const all = [...moves, ...future]
  if (all.length === 0) {
    return <p className="text-sm text-slate-500">No moves yet.</p>
  }

  const fields = startFen?.split(' ') ?? []
  const blackFirst = fields[1] === 'b'
  const firstNumber = Number(fields[5]) || 1

  // When Black moves first, the first row has an empty White cell ("12. ... Nf6").
  const cells: Cell[] = [...(blackFirst ? [null] : []), ...all.map((san, index) => ({ san, index }))]
  const rows: { number: number; white: Cell; black: Cell }[] = []
  for (let i = 0; i < cells.length; i += 2) {
    rows.push({ number: firstNumber + i / 2, white: cells[i], black: cells[i + 1] ?? null })
  }
  const current = moves.length - 1

  const cell = (c: Cell) => {
    if (!c) return <span className="text-slate-600">{blackFirst ? '...' : ''}</span>
    const style = c.index === current ? 'font-bold text-emerald-400' : c.index > current ? 'text-slate-500' : ''
    return (
      <span className={style} aria-current={c.index === current ? 'step' : undefined}>
        {c.san}
      </span>
    )
  }

  return (
    <ol data-testid="move-list" className="grid grid-cols-[2.5rem_1fr_1fr] gap-x-2 gap-y-1 font-mono text-sm">
      {rows.map((row) => (
        <li key={row.number} className="contents">
          <span className="text-slate-500">{row.number}.</span>
          {cell(row.white)}
          {row.black ? cell(row.black) : <span />}
        </li>
      ))}
    </ol>
  )
}
