import { useState } from 'react'
import { useParsePgn } from '../lib/creator.ts'
import type { Side } from '../lib/courses.ts'
import type { EditorLine } from '../lib/moveTree.ts'

type Props = {
  side: Side
  /** Called with the lines found in the PGN. The caller merges them into the tree. */
  onImport: (lines: EditorLine[]) => void
}

/** Paste a PGN (variations and comments included) and add its lines to the course. */
export default function PgnImporter({ side, onImport }: Props) {
  const [pgn, setPgn] = useState('')
  const parse = useParsePgn()

  function run() {
    parse.mutate(
      { pgn, side },
      {
        onSuccess: ({ lines }) => {
          onImport(lines)
          setPgn('')
        },
      },
    )
  }

  return (
    <details className="rounded-xl border border-slate-800 bg-slate-900 p-4" data-testid="pgn-importer">
      <summary className="cursor-pointer font-medium">Import from PGN</summary>
      <div className="mt-3 flex flex-col gap-3">
        <textarea
          rows={6}
          value={pgn}
          onChange={(e) => setPgn(e.target.value)}
          aria-label="PGN text"
          placeholder="1. e4 e5 2. Nf3 Nc6 (2... d6 3. d4) 3. Bc4 {The Italian.}"
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-emerald-400"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={!pgn.trim() || parse.isPending}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm hover:border-slate-400 disabled:opacity-40"
          >
            {parse.isPending ? 'Reading...' : 'Add lines'}
          </button>
          {parse.isError && (
            <p role="alert" className="text-sm text-red-400">
              {parse.error.message}
            </p>
          )}
          {parse.isSuccess && (
            <p data-testid="pgn-result" className="text-sm text-slate-400">
              Added {parse.data.lines.length} {parse.data.lines.length === 1 ? 'line' : 'lines'}.
              {parse.data.warnings.length > 0 && ` ${parse.data.warnings.length} adjusted.`} Remember to save.
            </p>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Variations in brackets become separate lines. Comments in braces are kept.
        </p>
      </div>
    </details>
  )
}
