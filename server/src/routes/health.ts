import { Router } from 'express'

export const healthRouter = Router()

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'openingdrill-api',
    time: new Date().toISOString(),
  })
})
