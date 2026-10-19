const link = 'underline hover:text-slate-300'

/** Credits, including the licence notice Stockfish (GPLv3) requires. */
export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-800 px-4 py-6 text-xs text-slate-500">
      <div className="mx-auto flex max-w-7xl flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-6">
        <p>
          Analysis by{' '}
          <a className={link} href="https://stockfishchess.org" target="_blank" rel="noreferrer">
            Stockfish
          </a>
          , free software under the{' '}
          <a className={link} href="/stockfish/LICENSE.txt" target="_blank">
            GNU GPL v3
          </a>
          , run in your browser via{' '}
          <a className={link} href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noreferrer">
            stockfish.js
          </a>{' '}
          (source code available there).
        </p>
        <p>
          Move statistics from the{' '}
          <a className={link} href="https://lichess.org" target="_blank" rel="noreferrer">
            Lichess
          </a>{' '}
          opening explorer.
        </p>
      </div>
    </footer>
  )
}
