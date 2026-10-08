type Props = {
  /** Short instruction, e.g. "Your move: 3. Bf4" or "Opponent is thinking...". */
  prompt: string
  /** The author's note for the current move, if any. */
  comment?: string
  /** Shown after a wrong try. */
  wrong?: boolean
  wrongText?: string
}

/** The text beside the board during a drill: what to do now, and why. */
export default function CommentPanel({
  prompt,
  comment,
  wrong = false,
  wrongText = 'Not that one. Follow the arrow.',
}: Props) {
  return (
    <div
      aria-live="polite"
      className={`flex min-h-28 flex-col gap-2 rounded-xl border p-4 transition-colors ${
        wrong ? 'border-red-500/70 bg-red-950/30' : 'border-slate-800 bg-slate-900'
      }`}
    >
      <p data-testid="drill-prompt" className="font-medium">
        {prompt}
      </p>
      {wrong && (
        <p data-testid="drill-wrong" className="text-sm text-red-400">
          {wrongText}
        </p>
      )}
      {comment && (
        <p data-testid="drill-comment" className="text-sm text-slate-300">
          {comment}
        </p>
      )}
    </div>
  )
}
