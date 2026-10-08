import cookieParser from 'cookie-parser'
import express, { type NextFunction, type Request, type Response } from 'express'
import { authRouter } from './routes/auth.js'
import { coursesRouter } from './routes/courses.js'
import { creatorRouter } from './routes/creator.js'
import { explorerRouter } from './routes/explorer.js'
import { googleRouter } from './routes/google.js'
import { healthRouter } from './routes/health.js'
import { leaderboardsRouter } from './routes/leaderboards.js'
import { statsRouter } from './routes/stats.js'
import { trainRouter } from './routes/train.js'

export function createApp() {
  const app = express()
  // How many proxies sit in front of the API. One locally (Vite or nginx); more in production.
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1)
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())

  app.use('/api', healthRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/auth', googleRouter)
  app.use('/api/courses', coursesRouter)
  app.use('/api/train', trainRouter)
  app.use('/api/creator', creatorRouter)
  app.use('/api/explorer', explorerRouter)
  app.use('/api/stats', statsRouter)
  app.use('/api/leaderboards', leaderboardsRouter)

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: 'Invalid JSON.' })
      return
    }
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  })

  return app
}
