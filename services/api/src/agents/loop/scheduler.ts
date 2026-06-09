/**
 * scheduler.ts
 *
 * Drives the agent loop tick on a configurable interval.
 * Uses setInterval by default; can be swapped for node-cron for more
 * complex schedules (e.g. "only run during market hours").
 *
 * Call startScheduler() from app.ts after DB connects.
 * Call stopScheduler() for a graceful shutdown.
 */

import { runLoopTick } from './agent.loop'
import { agentConfig } from '../../config/agent.config'

let _timer: NodeJS.Timeout | null = null
let _running = false   // prevents concurrent ticks if one runs long

export function startScheduler(): void {
  if (_timer) {
    console.warn('[Scheduler] Already running — stopScheduler() first.')
    return
  }

  const interval = agentConfig.loopIntervalMs
  console.log(`[Scheduler] Starting agent loop — interval: ${interval / 1000}s, mode: ${agentConfig.mode}`)

  _timer = setInterval(async () => {
    if (_running) {
      console.warn('[Scheduler] Skipping tick — previous tick still running.')
      return
    }

    if (!agentConfig.enabled) {
      // Don't log every skipped tick — it would flood the console
      return
    }

    _running = true
    try {
      await runLoopTick()
    } catch (err: any) {
      console.error('[Scheduler] Unhandled error in loop tick:', err.message)
    } finally {
      _running = false
    }
  }, interval)

  // Unref so the interval doesn't prevent clean process exit
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

/** Manually trigger one tick outside the schedule (for testing / admin API) */
export async function triggerOneTick(): Promise<void> {
  if (_running) throw new Error('A tick is already running — try again in a moment.')
  _running = true
  try {
    await runLoopTick()
  } finally {
    _running = false
  }
}
