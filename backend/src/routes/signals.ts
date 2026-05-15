import { Router, Request, Response } from 'express'
import { PrismaClient, SignalType } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

router.get('/', async (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { type, companyId, limit = '50' } = req.query

  const signals = await prisma.signal.findMany({
    where: {
      company: { userId },
      ...(type ? { type: type as SignalType } : {}),
      ...(companyId ? { companyId: companyId as string } : {}),
    },
    include: { company: true },
    orderBy: { detectedAt: 'desc' },
    take: parseInt(limit as string),
  })

  return res.json(signals)
})

// Internal endpoint for workers
router.post('/', async (req: Request, res: Response) => {
  const auth = req.headers.authorization
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' })

  const { companyId, type, title, url, summary, llmInsight } = req.body
  if (!companyId || !type || !title) return res.status(400).json({ error: 'Missing required fields' })

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const existing = await prisma.signal.findFirst({
    where: { companyId, title, detectedAt: { gte: sevenDaysAgo } },
  })

  if (existing) return res.json({ skipped: true, reason: 'duplicate' })

  const signal = await prisma.signal.create({
    data: { companyId, type, title, url, summary, llmInsight, isNew: true },
  })

  return res.status(201).json(signal)
})

export default router
