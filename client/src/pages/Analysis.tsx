import { validateFen } from 'chess.js'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import Board from '../components/Board.tsx'
import EngineEvalBar from '../components/EngineEvalBar.tsx'
import MoveList from '../components/MoveList.tsx'
import PositionTools from '../components/PositionTools.tsx'
import { type EngineStatus, formatScore, useEngine } from '../lib/chess/engine.ts'
import { type MoveInput, readPgn, START_FEN, toPgn } from '../lib/chess/game.ts'
import { isMuted, playSound, setMuted, soundForMove } from '../lib/chess/sounds.ts'
import { useChessGame } from '../lib/chess/useChessGame.ts'

const STATUS_TEXT = { playing: null, checkmate: 'Checkmate', stalemate: 'Stalemate', draw: 'Draw' } as const
const ENGINE_KEY = 'od.engine'
const buttonClass =
  'rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:border-slate-500 disabled:opacity-40'

const ENGINE_STATUS_TEXT: Record<EngineStatus, string> = {
  off: 'Engine is off.',
  loading: 'Loading Stockfish...',
  thinking: 'Thinking...',
  done: '',
  error: 'The engine could not start in this browser.',
}

function engineSaved(): boolean {
  try {
    return localStorage.getItem(ENGINE_KEY) !== '0'
  } catch {
    return true
  }
}

/** "12. Nf3 Nc6 13. Bb5", or "12... Nc6 13. Bb5" when Black is to move in `fen`. */
function numberedLine(fen: string, moves: string[]): string {
  const fields = fen.split(' ')
  let whiteToMove = fields[1] !== 'b'
  let number = Number(fields[5]) || 1
  const parts: string[] = []
  moves.forEach((san, i) => {
    if (whiteToMove) parts.push(`${number}. ${san}`)
    else {
      parts.push(i === 0 ? `${number}... ${san}` : san)
      number++
    }
    whiteToMove = !whiteToMove
  })
  return parts.join(' ')
}

/** The board itself. Remounted (via `key`) whenever a new starting position is requested in the URL. */
function AnalysisBoard({ startFen }: { startFen: string }) {
  const [, setParams] = useSearchParams()
  const game = useChessGame(startFen)
  const [orientation, setOrientation] = useState<'white' | 'black'>(startFen.split(' ')[1] === 'b' ? 'black' : 'white')
  const [muted, setMutedState] = useState(isMuted)
  const [engineOn, setEngineOn] = useState(engineSaved)
  // The position the moves on the board started from (changes when a PGN is loaded).
  const [baseFen, setBaseFen] = useState(startFen)

  const gameOver = game.status !== 'playing'
  const { info, status } = useEngine(engineOn && !gameOver ? game.fen : null)

  function onMove(input: MoveInput): boolean {
    const outcome = game.move(input)
    playSound(outcome ? soundForMove(outcome) : 'wrong')
    return outcome !== null
  }

  function toggleEngine() {
    const next = !engineOn
    setEngineOn(next)
    try {
      localStorage.setItem(ENGINE_KEY, next ? '1' : '0')
    } catch {
      // Not remembered; fine.
    }
  }

  function loadPgn(pgn: string): boolean {
    const parsed = readPgn(pgn)
    if (!parsed) return false
    setBaseFen(parsed.startFen)
    game.load(parsed.startFen, parsed.moves)
    return true
  }

  const statusText = STATUS_TEXT[game.status]
  const moves = game.history.map((m) => m.san)

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="mx-auto flex w-full max-w-[38rem] gap-2">
        {engineOn && <EngineEvalBar info={info} orientation={orientation} />}
        <div className="min-w-0 flex-1">
          <Board
            fen={game.fen}
            orientation={orientation}
            onMove={onMove}
            getLegalTargets={game.getLegalTargets}
            needsPromotion={game.needsPromotion}
            lastMove={game.lastMove}
            checkSquare={game.checkSquare}
            arrows={engineOn && info?.best ? [{ ...info.best, color: '#60a5fa' }] : []}
          />
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Analysis board</h1>
        <p data-testid="turn" className="text-sm text-slate-400">
          {statusText ?? (game.turn === 'w' ? 'White to move' : 'Black to move')}
        </p>

        <section className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 p-3" data-testid="engine-panel">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Stockfish</h2>
            <button type="button" className={buttonClass} onClick={toggleEngine} aria-pressed={engineOn}>
              {engineOn ? 'Engine on' : 'Engine off'}
            </button>
          </div>
          {engineOn && info && (
            <>
              <p className="text-sm">
                <span data-testid="engine-score" className="text-lg font-semibold tabular-nums">
                  {formatScore(info)}
                </span>{' '}
                <span data-testid="engine-depth" className="text-slate-400">
                  depth {info.depth}
                  {info.done ? '' : '...'}
                </span>
              </p>
              <p data-testid="engine-line" className="font-mono text-xs break-words text-slate-300">
                {numberedLine(game.fen, info.line.slice(0, 8))}
              </p>
            </>
          )}
          {engineOn && !info && (
            <p data-testid="engine-status" className="text-sm text-slate-400">
              {gameOver ? 'The game is over.' : ENGINE_STATUS_TEXT[status]}
            </p>
          )}
          <p className="text-xs text-slate-500">Runs in your browser. Positive scores favour White.</p>
        </section>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass}
            onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
          >
            Flip board
          </button>
          <button type="button" className={buttonClass} onClick={game.undo} disabled={game.history.length === 0}>
            Undo
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => game.reset(baseFen)}
            disabled={game.history.length === 0}
          >
            Reset
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              setMuted(!muted)
              setMutedState(!muted)
            }}
            aria-pressed={muted}
          >
            {muted ? 'Sound off' : 'Sound on'}
          </button>
        </div>

        <MoveList moves={moves} />
        <PositionTools
          fen={game.fen}
          pgn={toPgn(baseFen, moves)}
          onLoadFen={(fen) => setParams({ fen })}
          onLoadPgn={loadPgn}
        />
        <p className="text-xs text-slate-500">Right-drag on the board to draw arrows.</p>
      </aside>
    </main>
  )
}

/** Free board with engine analysis. /analysis?fen=... opens a specific position. */
export default function Analysis() {
  const [params] = useSearchParams()
  const requested = params.get('fen')
  // Invalid FENs fall back to the starting position.
  const startFen = requested && validateFen(requested).ok ? requested : START_FEN
  return <AnalysisBoard key={startFen} startFen={startFen} />
}
