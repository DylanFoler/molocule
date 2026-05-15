import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

router.get('/', async (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const digests = await prisma.digest.findMany({
    where: { repo: { userId } },
    include: { repo: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return res.json(digests)
})

export default router
