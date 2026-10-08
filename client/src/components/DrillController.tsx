import { useEffect, useRef, useState } from 'react'
import { type MoveInput, sanFor, squaresFor } from '../lib/chess/game.ts'
import { playSound, soundForMove } from '../lib/chess/sounds.ts'
import { useChessGame } from '../lib/chess/useChessGame.ts'
import type { Side } from '../lib/courses.ts'
import type { DrillLine, DrillResult } from '../lib/train.ts'
import Board from './Board.tsx'
import CommentPanel from './CommentPanel.tsx'
import MoveList from './MoveList.tsx'

type Props = {
  line: DrillLine
  side: Side
  startFen: string
  /**
   * learn:  the next move is shown with an arrow and the author's comment.
   * review: no hints. The user plays from memory; a wrong move reveals the answer.
   */
  mode: 'learn' | 'review'
  /** Called once, when the last move of the line has been played. */
  onComplete: (result: DrillResult) => void
}

const OPPONENT_DELAY_MS = 550

/** "3. Bf4" for White's moves, "3... Nf6" for Black's. `ply` is 0-based. */
function numbered(ply: number, san: string): string {
  const n = Math.floor(ply / 2) + 1
  return ply % 2 === 0 ? `${n}. ${san}` : `${n}... ${san}`
}

/**
 * Runs one line on the board. The user plays their side; the opponent's moves
 * play themselves after a short pause. Give it a `key` of the line id so a new
 * line starts from a fresh board.
 */
export default function DrillController({ line, side, startFen, mode, onComplete }: Props) {
  const game = useChessGame(startFen)
  // Counted once per move, however many wrong tries it took.
  const [mistakes, setMistakes] = useState(0)
  const [wrong, setWrong] = useState(false)
  const [startedAt] = useState(() => Date.now())
  const reported = useRef(false)
  // Thinking time for each move the user got right first try (review grading uses these).
  const turnStartedAt = useRef(0)
  const moveTimes = useRef<number[]>([])

  const ply = game.history.length
  const done = ply >= line.moves.length
  const expected = done ? null : line.moves[ply]
  const userColor = side === 'WHITE' ? 'w' : 'b'
  const isUserTurn = !done && game.turn === userColor
  const { move } = game

  // Opponent's move: play it automatically after a short pause.
  useEffect(() => {
    if (done || isUserTurn || !expected) return
    const timer = setTimeout(() => {
      const outcome = move(expected)
      if (outcome) playSound(soundForMove(outcome))
    }, OPPONENT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [done, isUserTurn, expected, move])

  // The clock for a move starts when it becomes the user's turn.
  useEffect(() => {
    if (isUserTurn) turnStartedAt.current = Date.now()
  }, [isUserTurn, ply])

  // Line finished: report once.
  useEffect(() => {
    if (!done || reported.current) return
    reported.current = true
    playSound('success')
    const times = moveTimes.current
    const total = times.reduce((sum, t) => sum + t, 0)
    onComplete({
      mistakes,
      ms: Date.now() - startedAt,
      avgMs: times.length > 0 ? Math.round(total / times.length) : 0,
      maxMs: times.length > 0 ? Math.max(...times) : 0,
    })
  }, [done, mistakes, onComplete, startedAt])

  function onMove(input: MoveInput): boolean {
    if (!isUserTurn || !expected) return false
    const san = sanFor(game.fen, input)
    if (san === null) return false // Not a legal move at all: just snap back, no penalty.
    if (san !== expected) {
      if (!wrong) setMistakes((m) => m + 1)
      setWrong(true)
      playSound('wrong')
      return false
    }
    if (!wrong) moveTimes.current.push(Date.now() - turnStartedAt.current)
    setWrong(false)
    const outcome = move(input)
    if (outcome) playSound(soundForMove(outcome))
    return outcome !== null
  }

  const isLearn = mode === 'learn'
  // Learn mode always shows the answer. Review mode shows it only after a wrong try.
  const showAnswer = isUserTurn && expected !== null && (isLearn || wrong)
  const hint = showAnswer && expected ? squaresFor(game.fen, expected) : null
  // Learn: on the user's turn show the note for the move they are about to play.
  // Review: never show a note ahead of the move, since it would give the answer away.
  const comment = line.comments[String(isLearn && isUserTurn ? ply + 1 : ply)]

  let prompt = 'Opponent is moving...'
  if (done) prompt = 'Line complete.'
  else if (isUserTurn && expected) {
    if (isLearn) prompt = `Your move: ${numbered(ply, expected)}`
    else prompt = wrong ? `The move was ${numbered(ply, expected)}. Play it to continue.` : 'Your move. What do you play here?'
  }

  return (
    <div
      className="grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem]"
      data-testid="drill"
      data-ply={ply}
      data-mistakes={mistakes}
    >
      <div className="mx-auto w-full max-w-[36rem]">
        <Board
          fen={game.fen}
          orientation={side === 'WHITE' ? 'white' : 'black'}
          interactive={isUserTurn}
          movableColor={userColor}
          onMove={onMove}
          getLegalTargets={game.getLegalTargets}
          needsPromotion={game.needsPromotion}
          lastMove={game.lastMove}
          checkSquare={game.checkSquare}
          arrows={hint ? [hint] : []}
        />
      </div>

      <aside className="flex flex-col gap-4">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">Line {line.order}</p>
          <h2 className="font-semibold">{line.name}</h2>
        </div>
        <CommentPanel
          prompt={prompt}
          comment={comment}
          wrong={wrong && isUserTurn}
          wrongText={isLearn ? 'Not that one. Follow the arrow.' : 'Not that one. The arrow shows the move.'}
        />
        <div
          className="h-1.5 overflow-hidden rounded-full bg-slate-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={line.moves.length}
          aria-valuenow={ply}
        >
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${(ply / line.moves.length) * 100}%` }}
          />
        </div>
        <MoveList moves={game.history.map((m) => m.san)} />
      </aside>
    </div>
  )
}
