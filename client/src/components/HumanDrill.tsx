import { useEffect, useRef, useState } from 'react'
import { type MoveInput, sanFor, squaresFor } from '../lib/chess/game.ts'
import { playSound, soundForMove } from '../lib/chess/sounds.ts'
import { useChessGame } from '../lib/chess/useChessGame.ts'
import type { Side } from '../lib/courses.ts'
import { courseReplies, fetchHumanStats, type HumanLine, pickReply, type RatingBucket } from '../lib/human.ts'
import Board from './Board.tsx'
import CommentPanel from './CommentPanel.tsx'
import MoveList from './MoveList.tsx'

export type HumanResult = {
  /** done: reached the end of a course line. left: the opponent played a move outside the course. */
  outcome: 'done' | 'left'
  mistakes: number
  moves: string[]
  finalFen: string
  lineName: string | null
}

type Props = {
  lines: HumanLine[]
  side: Side
  startFen: string
  bucket: RatingBucket
  /** If true the opponent may play any human move, including ones the course does not cover. */
  mayLeavePrep: boolean
  onFinish: (result: HumanResult) => void
}

const MIN_THINK_MS = 600
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Plays through a whole course against an opponent that chooses its replies
 * the way real players do. The user plays from memory, as in review mode, but
 * nothing here is graded or scheduled.
 */
export default function HumanDrill({ lines, side, startFen, bucket, mayLeavePrep, onFinish }: Props) {
  const game = useChessGame(startFen)
  const [mistakes, setMistakes] = useState(0)
  const [wrong, setWrong] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [noData, setNoData] = useState(false)
  const [leftPrep, setLeftPrep] = useState(false)
  const finished = useRef(false)

  const path = game.history.map((m) => m.san)
  const pathKey = path.join(' ')
  const ply = path.length
  const userColor = side === 'WHITE' ? 'w' : 'b'
  const isUserTurn = game.turn === userColor
  const replies = courseReplies(lines, path)
  const done = leftPrep || replies.length === 0
  const { move, fen } = game

  // Opponent's turn: look up how humans reply here, pick a move, play it.
  useEffect(() => {
    if (done || isUserTurn) return
    let cancelled = false
    const branches = courseReplies(lines, pathKey ? pathKey.split(' ') : [])
    void (async () => {
      const [stats] = await Promise.all([fetchHumanStats(fen, bucket).catch(() => null), sleep(MIN_THINK_MS)])
      if (cancelled) return
      if (!stats) setNoData(true)
      const reply = pickReply(branches, stats, mayLeavePrep)
      const outcome = move(reply.san)
      if (!outcome) return
      playSound(soundForMove(outcome))
      const percent = reply.share === null ? null : Math.max(1, Math.round(reply.share * 100))
      setNote(percent === null ? `Opponent played ${reply.san}.` : `Opponent played ${reply.san}, as in ${percent}% of games.`)
      if (!reply.inBook) setLeftPrep(true)
    })()
    return () => {
      cancelled = true
    }
  }, [done, isUserTurn, pathKey, fen, lines, bucket, mayLeavePrep, move])

  // Finished: report once.
  useEffect(() => {
    if (!done || finished.current) return
    finished.current = true
    if (!leftPrep) playSound('success')
    onFinish({
      outcome: leftPrep ? 'left' : 'done',
      mistakes,
      moves: pathKey ? pathKey.split(' ') : [],
      finalFen: fen,
      lineName: lines.find((l) => l.moves.join(' ') === pathKey)?.name ?? null,
    })
  }, [done, leftPrep, mistakes, pathKey, fen, lines, onFinish])

  function onMove(input: MoveInput): boolean {
    if (done || !isUserTurn) return false
    const san = sanFor(fen, input)
    if (san === null) return false
    if (!replies.includes(san)) {
      if (!wrong) setMistakes((m) => m + 1)
      setWrong(true)
      playSound('wrong')
      return false
    }
    setWrong(false)
    const outcome = move(input)
    if (outcome) playSound(soundForMove(outcome))
    return outcome !== null
  }

  const answer = replies[0]
  const hint = wrong && isUserTurn && answer ? squaresFor(fen, answer) : null
  let prompt = 'Opponent is thinking...'
  if (leftPrep) prompt = 'Opponent left your prep.'
  else if (done) prompt = 'End of your prep.'
  else if (isUserTurn) prompt = wrong ? `Your prep here is ${answer}. Play it to continue.` : 'Your move. What does your prep say?'

  return (
    <div
      className="grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem]"
      data-testid="human-drill"
      data-ply={ply}
      data-turn={done ? 'done' : isUserTurn ? 'user' : 'opponent'}
    >
      <div className="mx-auto w-full max-w-[36rem]">
        <Board
          fen={fen}
          orientation={side === 'WHITE' ? 'white' : 'black'}
          interactive={!done && isUserTurn}
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
        <CommentPanel
          prompt={prompt}
          comment={note ?? undefined}
          wrong={wrong && isUserTurn}
          wrongText="That is not in your course. The arrow shows your prep."
        />
        {noData && (
          <p data-testid="no-human-data" className="text-xs text-amber-300">
            Live game data is unavailable right now, so replies are picked evenly from your course.
          </p>
        )}
        <MoveList moves={path} />
      </aside>
    </div>
  )
}
