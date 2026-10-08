import { expect, test } from '@playwright/test'
import { boardFen, boardPieces, clickMove, dragMove, square } from './helpers.ts'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'

test.describe('analysis board', () => {
  test('moves by click and drag, and refuses illegal moves', async ({ page }) => {
    await page.goto('/analysis')
    await expect(page.locator('[data-square]')).toHaveCount(64)

    await clickMove(page, 'e2', 'e4')
    expect(await boardPieces(page)).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR')
    await dragMove(page, 'e7', 'e5')
    expect(await boardPieces(page)).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR')

    const before = await boardFen(page)
    await dragMove(page, 'a1', 'a5') // rook through its own pawn
    await dragMove(page, 'd7', 'd6') // Black piece on White's turn
    expect(await boardFen(page)).toBe(before)

    await expect(page.getByTestId('move-list')).toContainText('e4')
    await expect(page.getByTestId('turn')).toHaveText('White to move')
  })

  test('flip, undo and reset', async ({ page }) => {
    await page.goto('/analysis')
    await clickMove(page, 'e2', 'e4')
    await clickMove(page, 'e7', 'e5')

    const before = await square(page, 'a1').boundingBox()
    await page.getByRole('button', { name: 'Flip board' }).click()
    const after = await square(page, 'a1').boundingBox()
    expect(after!.x).toBeGreaterThan(before!.x)
    expect(after!.y).toBeLessThan(before!.y)

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => boardPieces(page)).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR')
    await page.getByRole('button', { name: 'Reset' }).click()
    await expect.poll(() => boardPieces(page)).toBe(START)
  })

  test('detects checkmate', async ({ page }) => {
    await page.goto('/analysis')
    for (const [from, to] of [['e2', 'e4'], ['e7', 'e5'], ['d1', 'h5'], ['b8', 'c6'], ['f1', 'c4'], ['g8', 'f6'], ['h5', 'f7']]) {
      await clickMove(page, from, to)
    }
    await expect(page.getByTestId('turn')).toHaveText('Checkmate')
  })

  test('asks which piece to promote to', async ({ page }) => {
    await page.goto(`/analysis?fen=${encodeURIComponent('8/P7/8/8/8/8/8/k6K w - - 0 1')}`)
    await dragMove(page, 'a7', 'a8')
    await expect(page.getByRole('dialog', { name: 'Choose promotion piece' })).toBeVisible()
    await page.getByRole('button', { name: 'Knight' }).click()
    await expect.poll(() => boardPieces(page)).toBe('N7/8/8/8/8/8/8/k6K')
  })

  test('opens a position from the address, and falls back on a bad one', async ({ page }) => {
    await page.goto(`/analysis?fen=${encodeURIComponent('6k1/5ppp/8/8/8/8/8/R6K w - - 0 1')}`)
    expect(await boardPieces(page)).toBe('6k1/5ppp/8/8/8/8/8/R6K')
    await page.goto('/analysis?fen=garbage')
    expect(await boardPieces(page)).toBe(START)
  })

  test('loads and exports FEN and PGN', async ({ page }) => {
    await page.goto('/analysis')
    await page.locator('[data-testid=position-tools] summary').click()

    await page.fill('input[aria-label="FEN to load"]', 'not a fen')
    await page.getByRole('button', { name: 'Load FEN' }).click()
    await expect(page.getByTestId('tools-message')).toHaveText('That is not a valid FEN.')

    await page.fill('textarea[aria-label="PGN to load"]', '1. e4 e5 2. Nf3 Nc6 (2... d6) 3. Bb5 {Ruy Lopez} a6 *')
    await page.getByRole('button', { name: 'Load PGN' }).click()
    await expect.poll(() => boardPieces(page)).toBe('r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R')
    await expect(page.getByTestId('current-pgn')).toHaveValue(/1\. e4 e5 2\. Nf3 Nc6 3\. Bb5 a6/)

    await page.fill('input[aria-label="FEN to load"]', '6k1/5ppp/8/8/8/8/8/R6K w - - 0 1')
    await page.getByRole('button', { name: 'Load FEN' }).click()
    await expect.poll(() => boardPieces(page)).toBe('6k1/5ppp/8/8/8/8/8/R6K')
    expect(page.url()).toContain('fen=6k1')
  })
})

test.describe('engine', () => {
  test('evaluates the starting position as roughly equal', async ({ page }) => {
    await page.goto('/analysis')
    await expect(page.getByTestId('engine-depth')).toHaveText('depth 18', { timeout: 60_000 })
    expect(Math.abs(Number(await page.getByTestId('engine-score').innerText()))).toBeLessThan(1)
    await expect(page.getByTestId('engine-line')).toHaveText(/^1\. \S+/)
  })

  test('finds mate in one for either side, scored from the White side', async ({ page }) => {
    await page.goto(`/analysis?fen=${encodeURIComponent('6k1/5ppp/8/8/8/8/8/R6K w - - 0 1')}`)
    await expect(page.getByTestId('engine-score')).toHaveText('M1', { timeout: 60_000 })
    await expect(page.getByTestId('engine-line')).toHaveText('1. Ra8#')
    await expect(page.getByTestId('eval-bar')).toHaveAttribute('data-share', '100')

    await page.goto(`/analysis?fen=${encodeURIComponent('r6k/8/8/8/8/8/5PPP/6K1 b - - 0 1')}`)
    await expect(page.getByTestId('engine-score')).toHaveText('-M1', { timeout: 60_000 })
    await expect(page.getByTestId('engine-line')).toHaveText('1... Ra1#')
    await expect(page.getByTestId('eval-bar')).toHaveAttribute('data-share', '0')
  })

  test('can be switched off, and the choice is remembered', async ({ page }) => {
    await page.goto('/analysis')
    await expect(page.getByTestId('eval-bar')).toBeVisible()
    await page.getByRole('button', { name: 'Engine on' }).click()
    await expect(page.getByTestId('eval-bar')).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Engine off' })).toBeVisible()
  })
})
