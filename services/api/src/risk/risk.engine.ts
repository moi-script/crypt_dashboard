/**
 * risk.engine.ts
 *
 * The single validation gate between policy (LLM decisions) and execution.
 * The LLM can NEVER reach the execution layer without passing through here.
 *
 * Usage:
 *   const result = riskEngine.validate(intent, walletState, mode)
 *   if (result.allowed) { execution.execute(intent) }
 */

import type { Intent, WalletState } from '../agents/loop/loop.types'
import type { AgentMode }           from '../config/agent.config'
import { RISK_LIMITS }              from './risk.config'
import {
  ruleAllowedTokens,
  ruleDailyLossCap,
  ruleMaxSlippage,
  ruleMaxTradeSize,
  ruleMinTradeSize,
  rulePaperModeOnly,
  ruleSelfTrade,
  type RuleContext,
  type RuleResult,
} from './risk.rules'

export interface ValidationResult {
  allowed:       boolean
  blockedBy?:    string       // rule name that blocked
  reason?:       string       // human-readable rejection reason
  checkedRules:  number       // how many rules ran
  passedRules:   number
}

type RuleFn = (ctx: RuleContext) => RuleResult

export class RiskEngine {
  validate(
    intent:      Intent,
    walletState: WalletState,
    mode:        AgentMode,
  ): ValidationResult {
    const limits = RISK_LIMITS[mode]
    const ctx: RuleContext = { intent, walletState, mode }

    if (limits.maxTradeUsd > 10_000) {
      console.warn(`[RiskEngine] maxTradeUsd=$${limits.maxTradeUsd} exceeds recommended ceiling of $10,000. Proceeding.`)
    }

    // All rules to run, in order
    const rules: { name: string; fn: () => RuleResult }[] = [
      { name: 'AllowedTokens', fn: ()  => ruleAllowedTokens(ctx) },
      { name: 'MaxTradeSize',  fn: ()  => ruleMaxTradeSize(ctx, limits.maxTradeUsd) },
      { name: 'MinTradeSize',  fn: ()  => ruleMinTradeSize(ctx) },
      { name: 'DailyLossCap', fn: ()  => ruleDailyLossCap(ctx, limits.dailyLossCapUsd) },
      { name: 'MaxSlippage',  fn: ()  => ruleMaxSlippage(ctx) },
      { name: 'PaperModeOnly',fn: ()  => rulePaperModeOnly(ctx, mode) },
      { name: 'SelfTrade',    fn: ()  => ruleSelfTrade(ctx) },
    ]

    let passed = 0
    for (const rule of rules) {
      const result = rule.fn()
      if (result.verdict === 'block') {
        console.warn(`[RiskEngine] BLOCKED by ${rule.name}: ${result.reason}`)
        return {
          allowed:      false,
          blockedBy:    rule.name,
          reason:       result.reason,
          checkedRules: rules.length,
          passedRules:  passed,
        }
      }
      passed++
    }

    return {
      allowed:      true,
      checkedRules: rules.length,
      passedRules:  passed,
    }
  }
}

export const riskEngine = new RiskEngine()
