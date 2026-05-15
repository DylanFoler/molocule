import { Router, Request, Response } from 'express'
import crypto from 'crypto'

const router = Router()

function verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

router.post('/github', async (req: Request, res: Response) => {
  const signature = req.headers['x-hub-signature-256'] as string
  const event = req.headers['x-github-event'] as string

  if (!signature || !process.env.GITHUB_WEBHOOK_SECRET) {
    return res.status(400).json({ error: 'Missing signature' })
  }

  const rawBody = JSON.stringify(req.body)
  if (!verifyGitHubSignature(rawBody, signature, process.env.GITHUB_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  // Handle PR events — trigger digest generation
  if (event === 'pull_request' && ['closed', 'merged'].includes(req.body.action)) {
    const repo = req.body.repository
    console.log(`PR ${req.body.action} in ${repo.full_name}: #${req.body.number}`)
    // In production: queue a digest generation job here
  }

  return res.json({ received: true, event })
})

export default router
