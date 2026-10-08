import { validateFen } from 'chess.js'
import { useState } from 'react'

type Props = {
  fen: string
  /** PGN of the game on the board. */
  pgn: string
  /** Load a position. The caller resets the board. */
  onLoadFen: (fen: string) => void
  /** Load a game. Returns false if the PGN could not be read. */
  onLoadPgn: (pgn: string) => boolean
}

const field =
  'rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-emerald-400'
const button = 'rounded-md border border-slate-700 px-2.5 py-1 text-sm hover:border-slate-500 disabled:opacity-40'

/** FEN and PGN in and out: copy the current position or game, or paste one to load it. */
export default function PositionTools({ fen, pgn, onLoadFen, onLoadPgn }: Props) {
  const [fenText, setFenText] = useState('')
  const [pgnText, setPgnText] = useState('')
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setMessage({ text: `${label} copied.`, ok: true })
    } catch {
      setMessage({ text: `Could not copy. Select the ${label} text and copy it by hand.`, ok: false })
    }
  }

  function loadFen() {
    const value = fenText.trim()
    if (!validateFen(value).ok) {
      setMessage({ text: 'That is not a valid FEN.', ok: false })
      return
    }
    onLoadFen(value)
    setFenText('')
    setMessage({ text: 'Position loaded.', ok: true })
  }

  function loadPgn() {
    if (onLoadPgn(pgnText)) {
      setPgnText('')
      setMessage({ text: 'Game loaded.', ok: true })
    } else {
      setMessage({ text: 'Could not read that PGN.', ok: false })
    }
  }

  return (
    <details className="rounded-xl border border-slate-800 bg-slate-900 p-3" data-testid="position-tools">
      <summary className="cursor-pointer text-sm font-medium">FEN and PGN</summary>
      <div className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Current FEN
          <input readOnly value={fen} data-testid="current-fen" onFocus={(e) => e.target.select()} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Current PGN
          <textarea readOnly rows={3} value={pgn} data-testid="current-pgn" onFocus={(e) => e.target.select()} className={field} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} onClick={() => copy('FEN', fen)}>
            Copy FEN
          </button>
          <button type="button" className={button} onClick={() => copy('PGN', pgn)} disabled={!pgn}>
            Copy PGN
          </button>
        </div>

        <div className="flex gap-2">
          <input
            value={fenText}
            onChange={(e) => setFenText(e.target.value)}
            aria-label="FEN to load"
            placeholder="Paste a FEN"
            className={`${field} min-w-0 flex-1`}
          />
          <button type="button" className={button} onClick={loadFen} disabled={!fenText.trim()}>
            Load FEN
          </button>
        </div>
        <textarea
          rows={3}
          value={pgnText}
          onChange={(e) => setPgnText(e.target.value)}
          aria-label="PGN to load"
          placeholder="Paste a PGN"
          className={field}
        />
        <button type="button" className={`${button} self-start`} onClick={loadPgn} disabled={!pgnText.trim()}>
          Load PGN
        </button>

        {message && (
          <p role="status" data-testid="tools-message" className={`text-xs ${message.ok ? 'text-slate-400' : 'text-red-400'}`}>
            {message.text}
          </p>
        )}
      </div>
    </details>
  )
}
