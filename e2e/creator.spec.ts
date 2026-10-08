import { expect, test } from '@playwright/test'
import { boardPieces, clickMove, createCourse, enroll, newSession, signUp, SMALL_PGN, squaresOf } from './helpers.ts'

const saved = (page: import('@playwright/test').Page) => expect(page.getByTestId('save-state')).toHaveText('All changes saved')

test('create a course from PGN, edit it on the board, and keep the changes', async ({ page }) => {
  await signUp(page, 'cr')
  await page.goto('/creator/new')
  await page.fill('input[name=title]', 'PW Creator Course')
  await page.fill('textarea[name=pgn]', '1. d4 d5 2. Bf4 {The London bishop.} Nf6 (2... c5 3. e3 (3. c3 Nc6) 3... Nc6) 3. e3 e6 4. Nf3 *')
  await page.getByRole('button', { name: 'Create course' }).click()

  await expect(page.getByTestId('line-count')).toHaveText('3 lines')
  await expect(page.getByTestId('move-tree')).toContainText('2... c5')
  await saved(page)
  const id = page.url().split('/').pop()!

  // Add a branch on the board.
  await page.locator('[data-path="d4 d5"]').click()
  await expect.poll(() => boardPieces(page)).toBe('rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR')
  await clickMove(page, 'c2', 'c4')
  await expect(page.getByTestId('line-count')).toHaveText('4 lines')
  await expect(page.getByTestId('save-state')).toHaveText('Unsaved changes')
  await page.locator('[data-testid=tree-editor] textarea').fill("Queen's Gambit instead.")
  await page.getByLabel('Name of line 4').fill('Gambit sideline')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await saved(page)

  await page.reload()
  await expect(page.getByTestId('line-count')).toHaveText('4 lines')
  const stored = await (await page.request.get(`/api/creator/courses/${id}`)).json()
  const gambit = stored.lines.find((l: { moves: string[] }) => l.moves.join(' ') === 'd4 d5 c4')
  expect(gambit).toMatchObject({ name: 'Gambit sideline', comments: { '3': "Queen's Gambit instead." } })
  // Lines that ended on Black's move were trimmed to end on White's.
  expect(stored.lines.map((l: { moves: string[] }) => l.moves.at(-1))).not.toContain('Nc6')

  // Delete the branch again, then import more PGN.
  await page.locator('[data-path="d4 d5 c4"]').click()
  await page.getByRole('button', { name: 'Delete this move' }).click()
  await expect(page.getByTestId('line-count')).toHaveText('3 lines')

  await page.locator('[data-testid=pgn-importer] summary').click()
  await page.getByLabel('PGN text').fill('1. e4 e5 2. Ke3')
  await page.getByRole('button', { name: 'Add lines' }).click()
  await expect(page.locator('[data-testid=pgn-importer] [role=alert]')).toHaveText('Game 1: "Ke3" is not a legal move after e4 e5.')
  await page.getByLabel('PGN text').fill('1. e4 e5 2. Nf3 Nc6 3. Bc4')
  await page.getByRole('button', { name: 'Add lines' }).click()
  await expect(page.getByTestId('line-count')).toHaveText('4 lines')
})

test('a private course is invisible to everyone but its author', async ({ page, browser }) => {
  await signUp(page, 'own')
  const course = await createCourse(page.request, { title: 'PW Private Course', side: 'WHITE', pgn: SMALL_PGN })
  const other = await newSession(browser, 'oth')
  const guest = await newSession(browser, null)

  for (const visitor of [other.page, guest.page]) {
    expect((await visitor.request.get(`/api/courses/${course.slug}`)).status()).toBe(404)
    expect((await visitor.request.get(`/api/courses/${course.slug}/first-line`)).status()).toBe(404)
  }
  expect((await other.page.request.get(`/api/creator/courses/${course.id}`)).status()).toBe(404)
  expect((await other.page.request.put(`/api/creator/courses/${course.id}`, { data: { title: 'Hacked' } })).status()).toBe(404)
  expect((await other.page.request.delete(`/api/creator/courses/${course.id}`)).status()).toBe(404)
  expect((await other.page.request.post(`/api/courses/${course.id}/enroll`)).status()).toBe(404)
  const catalog = await (await guest.page.request.get('/api/courses')).json()
  expect(catalog.courses.map((c: { slug: string }) => c.slug)).not.toContain(course.slug)

  // Official courses cannot be edited through the creator either.
  const london = await (await page.request.get('/api/courses/london-system')).json()
  expect((await page.request.put(`/api/creator/courses/${london.course.id}`, { data: { title: 'Hacked' } })).status()).toBe(404)

  await page.goto(`/course/${course.slug}`)
  await expect(page.getByTestId('private-badge')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Edit course' })).toBeVisible()
})

test('editing a course keeps review cards for unchanged lines', async ({ page }) => {
  await signUp(page, 'crd')
  const course = await createCourse(page.request, { title: 'PW Cards Course', side: 'WHITE', pgn: SMALL_PGN })
  await enroll(page.request, course.id)
  const [keep, drop] = course.lines
  for (const line of [keep, drop]) await page.request.post('/api/train/learned', { data: { lineId: line.id } })

  const lines = course.lines.filter((l) => l.id !== drop.id).map(({ name, moves, comments }) => ({ name, moves, comments }))
  lines.unshift({ name: 'New first', moves: ['c4'], comments: {} }) // shifts every order
  expect((await page.request.put(`/api/creator/courses/${course.id}`, { data: { lines } })).ok()).toBe(true)

  const after = await (await page.request.get(`/api/creator/courses/${course.id}`)).json()
  expect(after.lines[0].moves).toEqual(['c4'])
  expect(after.lines.find((l: { moves: string[] }) => l.moves.join(' ') === keep.moves.join(' ')).id).toBe(keep.id)
  const stats = await (await page.request.get('/api/stats/me')).json()
  expect(stats.learned).toBe(1) // the dropped line took its card with it

  const bad = await page.request.put(`/api/creator/courses/${course.id}`, { data: { lines: [{ moves: ['e4', 'e5', 'Qh9'] }] } })
  expect((await bad.json()).error).toBe('Line 1: move 3 ("Qh9") is not legal.')
})

test('publish, browse the community catalog, upvote and unpublish', async ({ page, browser }) => {
  const author = await signUp(page, 'pub')
  const course = await createCourse(page.request, { title: `PW Community ${Date.now().toString(36)}`, side: 'WHITE', pgn: SMALL_PGN })
  const title = (await (await page.request.get(`/api/creator/courses/${course.id}`)).json()).course.title as string

  await page.goto(`/creator/${course.id}`)
  await page.getByTestId('publish-button').click()
  await expect(page.getByTestId('publish-error')).toContainText('a one-sentence pitch')

  await page.fill('input[name=pitch]', 'A compact London repertoire for testing.')
  await expect(page.getByTestId('publish-button')).toBeDisabled() // unsaved changes
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await saved(page)
  await expect(page.getByTestId('publish-button')).toBeEnabled()
  await page.getByTestId('publish-button').click()
  await expect(page.getByTestId('publish-state')).toHaveText('Published to the community')

  // A guest finds it on the community page.
  const guest = await newSession(browser, null)
  await guest.page.goto('/community')
  await guest.page.fill('input[type=search]', title)
  const card = guest.page.locator('[data-testid=course-card]').filter({ hasText: title })
  await expect(card).toContainText(`by ${author.name}`)
  await expect(card).toContainText('0 upvotes')
  await expect(guest.page.locator('select[aria-label="Source"]')).toHaveCount(0)
  await expect(guest.page.locator('select[aria-label="Sort by"]')).toBeVisible()
  expect((await guest.page.request.post(`/api/courses/${course.id}/upvote`)).status()).toBe(401)

  // Another user upvotes it; the author cannot.
  const fan = await newSession(browser, 'fan')
  await fan.page.goto(`/course/${course.slug}`)
  await fan.page.getByTestId('upvote-button').click()
  await expect(fan.page.getByTestId('upvote-button')).toHaveText('Upvoted · 1 upvote')
  expect((await (await fan.page.request.post(`/api/courses/${course.id}/upvote`)).json()).upvotes).toBe(1)
  expect((await page.request.post(`/api/courses/${course.id}/upvote`)).status()).toBe(403)
  await enroll(fan.page.request, course.id)
  expect((await (await fan.page.request.get(`/api/train/learn/${course.id}`)).json()).lines).toHaveLength(3)

  // Unpublish: gone for others, still there for the author.
  await page.reload()
  await page.getByTestId('publish-button').click()
  await expect(page.getByTestId('publish-state')).toHaveText('Private')
  expect((await guest.page.request.get(`/api/courses/${course.slug}`)).status()).toBe(404)
  expect((await page.request.get(`/api/courses/${course.slug}`)).status()).toBe(200)
})

test('a course with too few lines cannot be published', async ({ page }) => {
  await signUp(page, 'thin')
  const course = await createCourse(page.request, { title: 'PW Thin Course', side: 'WHITE', pgn: '1. d4', pitch: 'A pitch that is long enough.' })
  const res = await page.request.post(`/api/creator/courses/${course.id}/publish`)
  expect(res.status()).toBe(400)
  expect((await res.json()).error).toContain('at least 3 lines (it has 1)')
})

test.describe('human moves mode', () => {
  const stats = (moves: Record<string, number>) => {
    const list = Object.entries(moves).map(([san, games]) => ({ san, uci: '', games }))
    return { total: list.reduce((n, m) => n + m.games, 0), moves: list, cached: true }
  }

  /** Plays our prepared move whenever it is our turn, until the game ends. Returns the moves played. */
  async function playOut(page: import('@playwright/test').Page, lines: string[][]) {
    const drill = page.getByTestId('human-drill')
    for (let guard = 0; guard < 30; guard++) {
      await expect(drill).not.toHaveAttribute('data-turn', 'opponent')
      if ((await drill.getAttribute('data-turn')) === 'done') break
      const played = (await page.locator('[data-testid=move-list] span').allInnerTexts()).filter((t) => t && !/^\d+\.$/.test(t))
      const next = lines.find((l) => played.every((san, i) => l[i] === san) && l.length > played.length)![played.length]
      const { from, to } = squaresOf(played, next)
      const before = Number(await drill.getAttribute('data-ply'))
      await clickMove(page, from, to)
      await expect.poll(async () => Number(await drill.getAttribute('data-ply'))).toBeGreaterThan(before)
    }
    return (await page.locator('[data-testid=move-list] span').allInnerTexts()).filter((t) => t && !/^\d+\.$/.test(t))
  }

  test('the opponent follows real frequencies within the course', async ({ page }) => {
    // Fix the dice so the weighted choice below is the same on every run.
    await page.addInitScript(() => {
      Math.random = () => 0.5
    })
    await signUp(page, 'hum')
    const course = await createCourse(page.request, { title: 'PW Human Course', side: 'WHITE', pgn: SMALL_PGN })
    const lines = course.lines.map((l) => l.moves)
    // Everyone plays ...c5 at move two; elsewhere the single course reply is played.
    await page.route('**/api/explorer**', (route) =>
      route.fulfill({ json: stats(route.request().url().includes('3P1B2') ? { c5: 900, Qd6: 100 } : { d5: 500, Nf6: 500 }) }),
    )

    await page.goto(`/course/${course.slug}`)
    await page.getByRole('link', { name: 'Play vs human moves' }).click()
    const moves = await playOut(page, lines)
    expect(moves).toEqual(['d4', 'd5', 'Bf4', 'c5', 'e3'])
    await expect(page.getByTestId('drill-comment')).toHaveText('Opponent played c5, as in 90% of games.')
    await expect(page.getByTestId('human-summary')).toContainText('End of your prep.')
    await expect(page.getByTestId('human-summary')).toContainText('No mistakes.')

    const after = await (await page.request.get('/api/stats/me')).json()
    expect(after).toMatchObject({ learned: 0, xp: 0 }) // nothing here is graded
  })

  test('with the option on, the opponent can leave the course', async ({ page }) => {
    await signUp(page, 'lv')
    const course = await createCourse(page.request, { title: 'PW Leave Course', side: 'WHITE', pgn: SMALL_PGN })
    await page.route('**/api/explorer**', (route) => route.fulfill({ json: stats({ e5: 1000 }) })) // not in the course

    await page.goto(`/train/human/${course.id}`)
    await page.getByLabel('Opponent may leave my prep').check()
    const moves = await playOut(page, course.lines.map((l) => l.moves))
    expect(moves).toEqual(['d4', 'e5'])
    await expect(page.getByTestId('drill-prompt')).toHaveText('Opponent left your prep.')
    await page.getByRole('link', { name: 'Open in analysis' }).click()
    await expect.poll(() => boardPieces(page)).toBe('rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR')
  })

  test('without live data the game still works and says so', async ({ page }) => {
    await signUp(page, 'nd')
    const course = await createCourse(page.request, { title: 'PW NoData Course', side: 'WHITE', pgn: SMALL_PGN })
    await page.route('**/api/explorer**', (route) => route.fulfill({ status: 503, json: { error: 'down' } }))

    await page.goto(`/train/human/${course.id}`)
    const moves = await playOut(page, course.lines.map((l) => l.moves))
    expect(course.lines.map((l) => l.moves.join(' '))).toContain(moves.join(' '))
    await expect(page.getByTestId('no-human-data')).toBeVisible()
  })

  test('the explorer proxy needs an account and valid input', async ({ page }) => {
    expect((await page.request.get('/api/explorer?fen=x')).status()).toBe(401)
    await signUp(page, 'px')
    expect((await page.request.get('/api/explorer?fen=garbage&ratings=club')).status()).toBe(400)
    const fen = encodeURIComponent('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    expect((await page.request.get(`/api/explorer?fen=${fen}&ratings=grandmaster`)).status()).toBe(400)
  })
})
