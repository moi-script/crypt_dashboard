/**
 * scheduler.ts
 *
 * Drives per-user agent loop ticks on a single global interval.
 * Each tick fans out to every user whose AgentConfig has enabled = true,
 * with bounded concurrency and a per-user in-flight guard.
 */

import { runLoopTick } from './agent.loop'
import { AgentConfigDoc } from '../../models/agentConfig.model'
import { DEFAULT_AGENT_CONFIG } from '../../config/agent.config'
import { runReflection }  from '../memory/reflection.generator'

const GLOBAL_INTERVAL_MS = Number(process.env.AGENT_LOOP_INTERVAL_MS) || DEFAULT_AGENT_CONFIG.loopIntervalMs
const MAX_CONCURRENT_TICKS = 4

const COINGECKO_TO_SYMBOL: Record<string, string> = {
  bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', binancecoin: 'BNB',
  cardano: 'ADA', polkadot: 'DOT', 'matic-network': 'MATIC',
  'avalanche-2': 'AVAX', chainlink: 'LINK', uniswap: 'UNI',
  dogecoin: 'DOGE', ripple: 'XRP', litecoin: 'LTC', cosmos: 'ATOM',
  filecoin: 'FIL',
}

let _timer: NodeJS.Timeout | null = null
let _sweeping = false
const _inFlight = new Set<string>()

/** Find all enabled users and run one bounded-concurrency tick per user. */
export async function runEnabledUserTicks(): Promise<void> {
  const enabled = await AgentConfigDoc
    .find({ enabled: true })
    .select('userId watchlist strategies')
    .lean()

  const userIds = enabled.map(c => c.userId).filter(id => !_inFlight.has(id))

  for (let i = 0; i < userIds.length; i += MAX_CONCURRENT_TICKS) {
    const batch = userIds.slice(i, i + MAX_CONCURRENT_TICKS)
    await Promise.all(batch.map(async userId => {
      _inFlight.add(userId)
      try {
        const cfg = enabled.find(c => c.userId === userId)!
        const isChartSignal = cfg.strategies?.chartSignal && (cfg.watchlist ?? [])[0]

        if (isChartSignal) {
          const raw = (cfg.watchlist[0] as string).toLowerCase()
          const symbol = COINGECKO_TO_SYMBOL[raw] ?? raw.toUpperCase()
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { runCoinAnalysis } = require('@/agents/coinAnalysis/coinAnalysis.runner') as typeof import('@/agents/coinAnalysis/coinAnalysis.runner')
          await runCoinAnalysis(userId, symbol, 'scheduler')
        } else {
          await runLoopTick(userId)
        }
      } catch (err: any) {
        console.error(`[Scheduler] Tick failed for ${userId}:`, err.message)
      } finally {
        _inFlight.delete(userId)
      }
    }))
  }
}

export function startScheduler(): void {
  if (_timer) {
    console.warn('[Scheduler] Already running — stopScheduler() first.')
    return
  }
  console.log(`[Scheduler] Starting per-user agent loop — interval: ${GLOBAL_INTERVAL_MS / 1000}s`)

  _timer = setInterval(async () => {
    if (_sweeping) {
      console.warn('[Scheduler] Skipping sweep — previous sweep still running.')
      return
    }
    _sweeping = true
    try {
      await runEnabledUserTicks()
    } catch (err: any) {
      console.error('[Scheduler] Sweep error:', err.message)
    } finally {
      _sweeping = false
    }
  }, GLOBAL_INTERVAL_MS)

  if (_timer.unref) _timer.unref()
}

export function stopScheduler(): void {
  if (_timer) {
    clearInterval(_timer)
    _timer = null
    console.log('[Scheduler] Agent loop stopped.')
  }
}

export function isSchedulerRunning(): boolean {
  return _timer !== null
}

// ── Nightly reflection sweep ──────────────────────────────────────────────────

let _reflectionTimer: NodeJS.Timeout | null = null

export function startReflectionScheduler(): void {
  if (_reflectionTimer) return

  const MS_PER_DAY = 24 * 60 * 60 * 1000

  _reflectionTimer = setInterval(async () => {
    try {
      const enabled = await AgentConfigDoc.find({ enabled: true }).select('userId watchlist').lean()
      for (const cfg of enabled) {
        const coins = (cfg.watchlist ?? ['bitcoin']).slice(0, 3)  // cap at 3 coins per user
        for (const coin of coins) {
          const symbol = coin.replace('bitcoin', 'BTC').replace('ethereum', 'ETH').toUpperCase()
          await runReflection(cfg.userId, symbol).catch(() => {})
        }
      }
    } catch (err: any) {
      console.error('[ReflectionScheduler] Sweep error:', err.message)
    }
  }, MS_PER_DAY)

  if (_reflectionTimer.unref) _reflectionTimer.unref()
  console.log('[ReflectionScheduler] Nightly reflection job started.')
}

export function stopReflectionScheduler(): void {
  if (_reflectionTimer) {
    clearInterval(_reflectionTimer)
    _reflectionTimer = null
  }
}

/** Manually trigger one tick for a single user (used by the admin/API trigger). */
export async function triggerOneTick(userId: string): Promise<void> {
  if (_inFlight.has(userId)) throw new Error('A tick is already running for this user — try again shortly.')
  _inFlight.add(userId)
  try {
    await runLoopTick(userId)
  } finally {
    _inFlight.delete(userId)
  }
}
