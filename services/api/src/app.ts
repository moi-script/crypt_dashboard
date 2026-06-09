import './config/env' // must be first — loads .env.local before any module reads process.env
import express from 'express'
import http from 'http'
import cors from 'cors'
import routes from './routes'
import { coinGeckoRouter } from './controllers/coingecko.controller'
import { errorHandler } from './middleware/errorHandler'
import { apiLimiter } from './middleware/rateLimit'
import { initWebSocket } from './websocket/wsServer'
import { connectDB } from './config/db'
import { connectRedis } from './config/redis'
import { connectSubscriber } from './websocket/redisSubscriber'
import morgan from 'morgan'

import agentRunRoutes                          from './routes/agentRun.routes'
import positionRoutes                          from './routes/position.routes'
import { opportunityRouter }                   from './routes/position.routes'
import { startScheduler, isSchedulerRunning }  from './agents/loop/scheduler'

const app = express()
const server = http.createServer(app)

console.log('OpenRouter key loaded:', !!process.env.OPENROUTER_API_KEY)

const allowedOrigins = (process.env.WEB_URL ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())
app.use(morgan('dev'))

// ── Rate limiters ─────────────────────────────────────────────────────────────
app.use('/api/coins',         apiLimiter)
app.use('/api/alerts',        apiLimiter)
app.use('/api/news',          apiLimiter)
app.use('/api/portfolio',     apiLimiter)
app.use('/api/agent-runs',    apiLimiter)
app.use('/api/positions',     apiLimiter)
app.use('/api/opportunities', apiLimiter)

app.use(
  [
    '/api/simple', '/api/categories', '/api/exchanges', '/api/derivatives',
    '/api/nfts', '/api/trending', '/api/global', '/api/search', '/api/platforms',
    '/api/contract', '/api/exchange_rates', '/api/entities', '/api/treasury', '/api/ping',
  ],
  apiLimiter,
)

// ── Route mounts ──────────────────────────────────────────────────────────────
app.use('/api', coinGeckoRouter)
app.use('/api', routes)
app.use('/api/agent-runs',    agentRunRoutes)
app.use('/api/positions',     positionRoutes)
app.use('/api/opportunities', opportunityRouter)
app.use(errorHandler)

initWebSocket(server)

async function start() {
  await connectDB()
  await connectRedis()
  await connectSubscriber()

  // Guard: prevents double-start on hot-reload
  if (!isSchedulerRunning()) {
    startScheduler()
  }

  server.listen(4000, () => console.log('API ready on :4000'))
}

start().catch((err) => {
  console.error('Startup failed:', err)
  process.exit(1)
})