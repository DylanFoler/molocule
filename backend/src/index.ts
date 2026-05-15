import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import companiesRouter from './routes/companies'
import signalsRouter from './routes/signals'
import reportsRouter from './routes/reports'
import webhooksRouter from './routes/webhooks'

dotenv.config()

const app = express()
const PORT = process.env.PORT ?? 5000

app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }))

app.use('/api/companies', companiesRouter)
app.use('/api/signals', signalsRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/webhooks', webhooksRouter)

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`))

export default app
