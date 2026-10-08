// Copies the Stockfish engine (single-threaded "lite" build) from node_modules
// into public/stockfish so the browser can load it as a web worker.
// Runs automatically before `npm run dev` and `npm run build`.
// The single-threaded build needs no special cross-origin headers.
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const pkgDir = path.dirname(require.resolve('stockfish/package.json'))
const outDir = path.resolve(import.meta.dirname, '..', 'public', 'stockfish')
mkdirSync(outDir, { recursive: true })

const files = [
  ['bin/stockfish-19-lite-single.js', 'stockfish.js'],
  ['bin/stockfish-19-lite-single.wasm', 'stockfish.wasm'],
  // Stockfish is GPLv3. Its license travels with the binary.
  ['Copying.txt', 'LICENSE.txt'],
]
for (const [from, to] of files) copyFileSync(path.join(pkgDir, from), path.join(outDir, to))
console.log(`Stockfish copied to ${path.relative(process.cwd(), outDir)}`)
