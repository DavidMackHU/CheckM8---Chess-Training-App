import { Chess } from 'chess.js'
import { useCallback, useMemo, useState } from 'react'
import {
  checkedKingSquare,
  gameStatus,
  isPromotionMove,
  legalTargets,
  type MoveInput,
  type MoveOutcome,
  playMove,
  START_FEN,
} from './game.ts'

/**
 * React state for one chess game. All rules come from chess.js; this hook only
 * keeps the position and move history in sync with the UI.
 */
export function useChessGame(startFen: string = START_FEN) {
  // The Chess instance is mutable, so it lives in state once and `history`
  // is the value React actually re-renders on.
  const [chess] = useState(() => new Chess(startFen))
  const [history, setHistory] = useState<MoveOutcome[]>([])

  const move = useCallback(
    (input: MoveInput | string): MoveOutcome | null => {
      const outcome = playMove(chess, input)
      if (outcome) setHistory((h) => [...h, outcome])
      return outcome
    },
    [chess],
  )

  const undo = useCallback(() => {
    if (chess.undo()) setHistory((h) => h.slice(0, -1))
  }, [chess])

  const reset = useCallback(
    (fen: string = startFen) => {
      chess.load(fen)
      setHistory([])
    },
    [chess, startFen],
  )

  /** Replaces the game: a starting position plus moves played from it. Stops at the first illegal move. */
  const load = useCallback(
    (fen: string, moves: string[]) => {
      chess.load(fen)
      const played: MoveOutcome[] = []
      for (const san of moves) {
        const outcome = playMove(chess, san)
        if (!outcome) break
        played.push(outcome)
      }
      setHistory(played)
    },
    [chess],
  )

  // `history` is listed so these recompute after every move, undo or reset.
  const derived = useMemo(
    () => ({
      fen: chess.fen(),
      turn: chess.turn(),
      status: gameStatus(chess),
      checkSquare: checkedKingSquare(chess),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chess, history],
  )

  const getLegalTargets = useCallback((square: string) => legalTargets(chess, square), [chess])
  const needsPromotion = useCallback(
    (from: string, to: string) => isPromotionMove(chess, from, to),
    [chess],
  )

  return {
    ...derived,
    history,
    lastMove: history.at(-1) ?? null,
    move,
    undo,
    reset,
    load,
    getLegalTargets,
    needsPromotion,
  }
}

export type ChessGame = ReturnType<typeof useChessGame>
