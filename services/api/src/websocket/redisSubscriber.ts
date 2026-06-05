import { createClient } from 'redis'

// Separate client — a subscribed client can't run other commands
export const redisSubscriber = createClient({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
})

redisSubscriber.on('error', (err) => console.error('[RedisSubscriber]', err))

export const connectSubscriber = async () => {
  await redisSubscriber.connect()
  console.log('Redis subscriber connected')
}