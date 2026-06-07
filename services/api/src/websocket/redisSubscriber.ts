import { createClient } from 'redis'

/**
 * Pub/Sub subscriber for live price/alert push over WebSocket.
 *
 * Pub/Sub crosses process boundaries (the Python worker publishes, this API
 * subscribes), so it CANNOT fall back to an in-memory cache. When REDIS_URL is
 * absent we expose a no-op subscriber: the app still boots and serves cached
 * REST data, but live WebSocket updates are disabled.
 */

type SubscribeListener = (message: string, channel: string) => void

interface Subscriber {
  subscribe(channels: string[], listener: SubscribeListener): Promise<void> | void
}

const REDIS_URL = process.env.REDIS_URL

const redisClient = REDIS_URL ? createClient({ url: REDIS_URL }) : null

if (redisClient) {
  redisClient.on('error', (err) => console.error('[RedisSubscriber]', err))
}

export const redisSubscriber: Subscriber = redisClient
  ? (redisClient as unknown as Subscriber)
  : {
      subscribe: () => {
        console.warn(
          '[RedisSubscriber] No REDIS_URL — live WebSocket updates disabled ' +
            '(cache running in-memory).',
        )
      },
    }

export const connectSubscriber = async () => {
  if (redisClient) {
    await redisClient.connect()
    console.log('Redis subscriber connected')
  }
}
