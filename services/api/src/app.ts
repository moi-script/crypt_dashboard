import express from 'express'
import http from 'http'
import cors from 'cors'
import routes from './routes'
import { errorHandler } from './middleware/errorHandler'
import { apiLimiter } from './middleware/rateLimit'
import { initWebSocket } from './websocket/wsServer'
import { connectDB } from './config/db'
import { connectRedis } from './config/redis'
import { connectSubscriber } from './websocket/redisSubscriber'

const app = express()
const server = http.createServer(app)

app.use(cors({ origin: process.env.WEB_URL }))
app.use(express.json())

// Auth has its own stricter limiter applied inside auth.routes.ts
// so we exclude /api/auth from the general limiter
app.use('/api/coins',     apiLimiter)
app.use('/api/alerts',    apiLimiter)
app.use('/api/news',      apiLimiter)
app.use('/api/portfolio', apiLimiter)

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