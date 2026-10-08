import { useId } from 'react'
import { Chessboard } from 'react-chessboard'

type Props = { fen: string; orientation?: 'white' | 'black' }

/** Small, non-interactive board used on course cards and headers. */
export default function BoardThumbnail({ fen, orientation = 'white' }: Props) {
  const id = useId()
  return (
    <div className="pointer-events-none aspect-square w-full" aria-hidden="true">
      <Chessboard
        options={{
          id: `thumb-${id}`,
          position: fen,
          boardOrientation: orientation,
          allowDragging: false,
          allowDrawingArrows: false,
          showNotation: false,
          showAnimations: false,
          lightSquareStyle: { backgroundColor: '#e6ebf0' },
          darkSquareStyle: { backgroundColor: '#6f8fa9' },
          boardStyle: { borderRadius: 6, overflow: 'hidden' },
        }}
      />
    </div>
  )
}
