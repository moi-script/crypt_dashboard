/**
 * strategy.types.ts
 *
 * Shared types for the policy / strategy layer.
 */

import type { LoopContext } from '../../loop/loop.types'

export interface StrategyResult {
  strategyName: string
  contextSummary: string     // short string that feeds into the LLM context window
  metadata: Record<string, unknown>  // raw data the strategy gathered
}

export interface Strategy {
  name: string
  description: string
  /** Build the context summary for the LLM. Called by the policy engine. */
  buildContext(ctx: LoopContext): Promise<StrategyResult>
}
