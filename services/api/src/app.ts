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
import paperWalletRoutes from './routes/paperWallet.routes'
import agentRunRoutes                          from './routes/agentRun.routes'
import positionRoutes                          from './routes/position.routes'
import { opportunityRouter }                   from './routes/position.routes'
import { startScheduler, isSchedulerRunning, startReflectionScheduler }  from './agents/loop/scheduler'
import { startPositionMonitor, isPositionMonitorRunning } from './agents/loop/positionMonitor'
import agent from './routes/agent.routes';
// ── S03 routes ────────────────────────────────────────────────────────────────
import intelligenceRouter  from './routes/intelligence.routes'
import chartAnalysisRouter from './routes/chartAnalysis.routes'
import orderBlockRouter    from './routes/orderBlock.routes'
import coin from './routes/coin.routes';
// ── OHLCV ingest singleton (must be initialized after Redis connects) ─────────
import { ohlcvIngest } from './read/ingestion/ohlcv.ingest'
import analysisRoutes from './routes/analysis.routes'
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


// apiLimiter
// ── Rate limiters ─────────────────────────────────────────────────────────────
app.use('/api/coins',         apiLimiter)
app.use('/api/alerts',        apiLimiter)
app.use('/api/news',          apiLimiter)
app.use('/api/portfolio',     apiLimiter)
app.use('/api/agent-runs',    apiLimiter)
app.use('/api/positions',     apiLimiter)
app.use('/api/opportunities',apiLimiter )
app.use('/api/intelligence',  apiLimiter)
app.use('/api/chart',        apiLimiter )
app.use('/api/orderblocks',   apiLimiter)
app.use(
  [
    '/api/simple', '/api/categories', '/api/exchanges', '/api/derivatives',
    '/api/nfts', '/api/trending', '/api/global', '/api/search', '/api/platforms',
    '/api/contract', '/api/exchange_rates', '/api/entities', '/api/treasury', '/api/ping',
  ],apiLimiter
)

// ── Route mounts ──────────────────────────────────────────────────────────────
app.use('/api', coinGeckoRouter)
app.use('/api', routes)
app.use('/api/agent-runs',    agentRunRoutes)
app.use('/api/positions',     positionRoutes)
app.use('/api/opportunities', opportunityRouter)
app.use('/api/paper-wallet',  paperWalletRoutes)
app.use("/api/coins", coin);
app.use("/api/agent", agent);
// ── S03 route mounts ──────────────────────────────────────────────────────────
app.use('/api/intelligence',  intelligenceRouter)
app.use('/api/chart',         chartAnalysisRouter)
app.use('/api/orderblocks',   orderBlockRouter)
app.use('/api/analysis', analysisRoutes)
app.use(errorHandler)

initWebSocket(server)

async function start() {
  await connectDB()
  await connectRedis()
  await connectSubscriber()

  // Initialize OHLCV ingest Redis connection AFTER connectRedis() completes.
  // Without this, ohlcvIngest.redisClient is null and every Binance fetch
  // skips the cache, causing rate limit hits within minutes.
  try {
    await ohlcvIngest.init()
    console.log('OHLCV ingest Redis connected')
  } catch (err: any) {
    console.warn('[app] ohlcvIngest.init() failed — OHLCV will run without Redis cache:', err.message)
    // Non-fatal: the ingest still works, just without caching
  }

  // Guard: prevents double-start on hot-reload
  if (!isSchedulerRunning()) {
    startScheduler()
  }
  startReflectionScheduler()
  if (!isPositionMonitorRunning()) {
    startPositionMonitor()
  }

  server.listen(4000, () => console.log('API ready on :4000'))
}

start().catch((err) => {
  console.error('Startup failed:', err)
  process.exit(1)
})