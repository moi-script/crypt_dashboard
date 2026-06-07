import { createClient } from 'redis'
import NodeCache from 'node-cache'

/**
 * Cache layer with automatic fallback.
 *
 * - If REDIS_URL is set → use Redis (shared across processes, survives restarts).
 * - If not              → fall back to an in-memory node-cache.
 *
 * Both expose the same `get` / `set(key, val, { EX }) ` / `del` surface, so every
 * service that imports `{ redis }` works unchanged.
 *
 * In-memory caveats (single-process only):
 *   - cleared on restart (cold cache)
 *   - not shared across multiple API instances or the Python worker
 */

export interface CacheClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, opts?: { EX?: number }): Promise<unknown>
  del(key: string): Promise<unknown>
}

const REDIS_URL = process.env.REDIS_URL

/** In-memory cache matching the subset of the Redis API the services use. */
function createMemoryCache(): CacheClient {
  // checkperiod sweeps expired keys so memory doesn't grow unbounded.
  // useClones: false — we only ever store immutable JSON strings, so skip the copy.
  const store = new NodeCache({ checkperiod: 120, useClones: false })

  return {
    async get(key) {
      const v = store.get<string>(key)
      return v === undefined ? null : v
    },
    async set(key, value, opts) {
      // node-cache TTL is in seconds; 0 = no expiry.
      store.set(key, value, opts?.EX ?? 0)
    },
    async del(key) {
      store.del(key)
    },
  }
}

const usingRedis = Boolean(REDIS_URL)

const redisClient = usingRedis
  ? createClient({ url: REDIS_URL })
  : null

if (redisClient) {
  redisClient.on('error', (err) => console.error('[Redis]', err))
}

export const redis: CacheClient = redisClient
  ? (redisClient as unknown as CacheClient)
  : createMemoryCache()

export const connectRedis = async () => {
  if (redisClient) {
    await redisClient.connect()
    console.log('Redis connected')
  } else {
    console.warn(
      '[Cache] No REDIS_URL set — using in-memory node-cache ' +
        '(single-process, cleared on restart).',
    )
  }
}
