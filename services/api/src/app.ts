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
import morgan from 'morgan';
const app = express()
const server = http.createServer(app)

// WEB_URL may list multiple allowed origins separated by commas
// (e.g. "http://localhost:3000,http://localhost:3001"). Split into an array so
// the cors middleware matches each one exactly instead of treating the whole
// comma-joined string as a single origin.
const allowedOrigins = (process.env.WEB_URL ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())
app.use(morgan('dev'))
// Auth has its own stricter limiter applied inside auth.routes.ts
// so we exclude /api/auth from the general limiter
app.use('/api/coins',     apiLimiter)
app.use('/api/alerts',    apiLimiter)
app.use('/api/news',      apiLimiter)
app.use('/api/portfolio', apiLimiter)

// CoinGecko-backed data endpoints (all other /api prefixes served by coinGeckoRouter)
app.use(
  [
    '/api/simple', '/api/categories', '/api/exchanges', '/api/derivatives',
    '/api/nfts', '/api/trending', '/api/global', '/api/search', '/api/platforms',
    '/api/contract', '/api/exchange_rates', '/api/entities', '/api/treasury', '/api/ping',
  ],
  apiLimiter,
)

// Mount CoinGecko router first so its specific paths (e.g. /coins/list, /coins/markets)
// resolve before the generic /coins/:id route inside ./routes.
app.use('/api', coinGeckoRouter)
app.use('/api', routes)
app.use(errorHandler)

initWebSocket(server)

async function start() {
  await connectDB()
  await connectRedis()
  await connectSubscriber()
  server.listen(4000, () => console.log('API ready on :4000'))
}

start().catch((err) => {
  console.error('Startup failed:', err)
  process.exit(1)
})