import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

function getUserId(req: Request): string | null {
  return req.headers['x-user-id'] as string ?? null
}

router.get('/', async (req: Request, res: Response) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const companies = await prisma.company.findMany({
    where: { userId },
    include: { _count: { select: { signals: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return res.json(companies)
})

router.post('/', async (req: Request, res: Response) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { name, website, linkedinUrl, githubOrg, blogRssUrl } = req.body
  if (!name || !website) return res.status(400).json({ error: 'name and website required' })

  const company = await prisma.company.create({
    data: { userId, name, website, linkedinUrl, githubOrg, blogRssUrl },
  })

  return res.status(201).json(company)
})

router.delete('/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  await prisma.company.deleteMany({ where: { id: req.params.id, userId } })
  return res.json({ success: true })
})

export default router
