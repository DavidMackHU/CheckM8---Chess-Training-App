/**
 * Minimal Lichess opening-explorer client for the API server. Lichess tolerates
 * roughly 20 requests a minute, one at a time. Calls are queued and drawn from
 * an allowance that permits a short burst (one game's worth of lookups) and
 * then refills slowly. After a "too many requests" answer nothing is sent for
 * a minute.
 */

export type HumanMove = { san: string; uci: string; games: number }
export type HumanStats = { total: number; moves: HumanMove[] }

/** Rating groups a user can pick. Values are Lichess's own rating buckets. */
export const RATING_BUCKETS = {
  beginner: '1000,1200',
  club: '1400,1600',
  strong: '1800,2000',
  expert: '2200,2500',
} as const
export type RatingBucket = keyof typeof RATING_BUCKETS
export const isRatingBucket = (value: unknown): value is RatingBucket =>
  typeof value === 'string' && value in RATING_BUCKETS

export class ExplorerUnavailable extends Error {}

const HOST = 'https://explorer.lichess.org'
const BURST = 12
const REFILL_MS = 3_000
/** Longest a lookup may wait for allowance before giving up, so a game never stalls. */
const MAX_WAIT_MS = 6_000
const COOL_DOWN_MS = 60_000

let queue: Promise<unknown> = Promise.resolve()
let allowance = BURST
let refilledAt = Date.now()
let blockedUntil = 0

/** Takes one request from the allowance, waiting briefly for a refill if it is empty. */
async function takeAllowance(): Promise<void> {
  const refill = () => {
    const earned = Math.floor((Date.now() - refilledAt) / REFILL_MS)
    if (earned > 0) {
      allowance = Math.min(BURST, allowance + earned)
      refilledAt += earned * REFILL_MS
    }
  }
  refill()
  if (allowance === 0) {
    const wait = refilledAt + REFILL_MS - Date.now()
    if (wait > MAX_WAIT_MS) throw new ExplorerUnavailable('Too many lookups right now. Try again shortly.')
    await sleep(wait)
    refill()
  }
  allowance--
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type RawMove = { san: string; uci: string; white: number; draws: number; black: number }

async function request(fen: string, bucket: RatingBucket, token: string): Promise<HumanStats> {
  if (Date.now() < blockedUntil) throw new ExplorerUnavailable('Lichess asked us to slow down. Try again in a minute.')
  await takeAllowance()

  const params = new URLSearchParams({
    variant: 'standard',
    speeds: 'blitz,rapid,classical',
    ratings: RATING_BUCKETS[bucket],
    fen,
  })
  let res: Response
  try {
    res = await fetch(`${HOST}/lichess?${params}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new ExplorerUnavailable('Could not reach Lichess.')
  }
  if (res.status === 429) {
    blockedUntil = Date.now() + COOL_DOWN_MS
    throw new ExplorerUnavailable('Lichess asked us to slow down. Try again in a minute.')
  }
  if (!res.ok) throw new ExplorerUnavailable(`Lichess explorer answered with status ${res.status}.`)

  const data = (await res.json()) as { moves?: RawMove[] }
  const moves = (data.moves ?? []).map((m) => ({ san: m.san, uci: m.uci, games: m.white + m.draws + m.black }))
  return { total: moves.reduce((n, m) => n + m.games, 0), moves }
}

/** How often each move is played from `fen` by players in the rating bucket. */
export function fetchHumanStats(fen: string, bucket: RatingBucket, token: string | undefined): Promise<HumanStats> {
  if (!token) return Promise.reject(new ExplorerUnavailable('LICHESS_TOKEN is not configured on the server.'))
  // Chain onto the queue so only one request is in flight; a failure must not break the chain.
  const result = queue.then(() => request(fen, bucket, token))
  queue = result.catch(() => undefined)
  return result
}
