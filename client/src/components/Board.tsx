import { type CSSProperties, useMemo, useState } from 'react'
import { type Arrow, Chessboard, type PieceDropHandlerArgs, type SquareHandlerArgs } from 'react-chessboard'
import type { MoveInput, PromotionPiece } from '../lib/chess/game.ts'
import PromotionPicker from './PromotionPicker.tsx'

export type BoardArrow = { from: string; to: string; color?: string }

type Props = {
  fen: string
  orientation?: 'white' | 'black'
  /** When false the board is display-only (e.g. while the opponent's move plays). */
  interactive?: boolean
  /** Which side the user may move. Omit to allow whichever side is to move. */
  movableColor?: 'w' | 'b'
  /** Try to play a move. Return false to reject it (the piece snaps back). */
  onMove: (move: MoveInput) => boolean
  getLegalTargets: (square: string) => string[]
  needsPromotion: (from: string, to: string) => boolean
  lastMove?: { from: string; to: string } | null
  checkSquare?: string | null
  /** Teaching arrows drawn by the app. Users can also right-drag their own. */
  arrows?: BoardArrow[]
}

const LIGHT = '#e6ebf0'
const DARK = '#6f8fa9'
const HINT_ARROW = '#34d399'

const lastMoveStyle: CSSProperties = { backgroundColor: 'rgba(250, 204, 21, 0.45)' }
const selectedStyle: CSSProperties = { backgroundColor: 'rgba(52, 211, 153, 0.55)' }
// Gradients go in backgroundImage so they can sit on top of a backgroundColor highlight on the same square.
const checkStyle: CSSProperties = {
  backgroundImage: 'radial-gradient(circle, rgba(239,68,68,0.9) 0%, rgba(239,68,68,0.35) 60%, transparent 75%)',
}
const targetStyle: CSSProperties = {
  backgroundImage: 'radial-gradient(circle, rgba(15,23,42,0.35) 22%, transparent 24%)',
}

export default function Board({
  fen,
  orientation = 'white',
  interactive = true,
  movableColor,
  onMove,
  getLegalTargets,
  needsPromotion,
  lastMove,
  checkSquare,
  arrows = [],
}: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null)

  const turn = fen.split(' ')[1] === 'b' ? 'b' : 'w'
  const canMoveNow = interactive && (movableColor === undefined || movableColor === turn)
  const targets = useMemo(
    () => (selected && canMoveNow ? getLegalTargets(selected) : []),
    [selected, canMoveNow, getLegalTargets],
  )

  /** Returns true if the move was played. Promotions open the picker instead. */
  function attempt(from: string, to: string): boolean {
    setSelected(null)
    if (!canMoveNow || from === to) return false
    if (needsPromotion(from, to)) {
      setPendingPromotion({ from, to })
      return false
    }
    return onMove({ from, to })
  }

  function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare) return false
    return attempt(sourceSquare, targetSquare)
  }

  function isOwnPiece(pieceType: string | undefined): boolean {
    return pieceType !== undefined && pieceType[0] === turn
  }

  function onSquareClick({ square, piece }: SquareHandlerArgs) {
    if (!canMoveNow) return
    if (selected && targets.includes(square)) {
      attempt(selected, square)
      return
    }
    setSelected(isOwnPiece(piece?.pieceType) && square !== selected ? square : null)
  }

  function choosePromotion(piece: PromotionPiece | null) {
    const pending = pendingPromotion
    setPendingPromotion(null)
    if (pending && piece) onMove({ ...pending, promotion: piece })
  }

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {}
    if (lastMove) {
      styles[lastMove.from] = lastMoveStyle
      styles[lastMove.to] = lastMoveStyle
    }
    if (checkSquare) styles[checkSquare] = checkStyle
    for (const square of targets) styles[square] = { ...styles[square], ...targetStyle }
    if (selected) styles[selected] = selectedStyle
    return styles
  }, [lastMove, checkSquare, targets, selected])

  const boardArrows: Arrow[] = useMemo(
    () => arrows.map((a) => ({ startSquare: a.from, endSquare: a.to, color: a.color ?? HINT_ARROW })),
    [arrows],
  )

  return (
    <div className="relative aspect-square w-full" data-testid="board" data-fen={fen}>
      <Chessboard
        options={{
          id: 'board',
          position: fen,
          boardOrientation: orientation,
          allowDragging: canMoveNow,
          canDragPiece: ({ piece }) => canMoveNow && isOwnPiece(piece.pieceType),
          onPieceDrop,
          onSquareClick,
          onPieceDrag: ({ square }) => setSelected(square),
          squareStyles,
          arrows: boardArrows,
          allowDrawingArrows: true,
          animationDurationInMs: 180,
          lightSquareStyle: { backgroundColor: LIGHT },
          darkSquareStyle: { backgroundColor: DARK },
          boardStyle: { borderRadius: 6, overflow: 'hidden' },
        }}
      />
      {pendingPromotion && <PromotionPicker color={turn} onChoose={choosePromotion} />}
    </div>
  )
}
