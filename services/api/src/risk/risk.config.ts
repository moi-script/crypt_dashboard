/**
 * risk.config.ts
 *
 * Numeric risk limits per execution mode.
 * These are the values the risk rules check against.
 */

export interface RiskLimits {
  maxTradeUsd:      number
  dailyLossCapUsd:  number
  maxSlippageBps:   number
  minProfitOverGasUsd: number   // cancel trade if expected profit < this (gas bleed guard)
  maxOpenPositions: number
  allowedVenues:    string[]    // accepted venue strings in TradeIntent
}

export const RISK_LIMITS: Record<'paper' | 'cex' | 'onchain', RiskLimits> = {
  paper: {
    maxTradeUsd:          10_000,   // liberal in paper — it's simulated
    dailyLossCapUsd:      500,
    maxSlippageBps:       200,
    minProfitOverGasUsd:  0,        // gas is free in paper mode
    maxOpenPositions:     20,
    allowedVenues:        ['paper', 'binance', 'uniswap_v3_base', 'uniswap_v3_arb'],
  },
  cex: {
    maxTradeUsd:          100,      // start tiny — phase 2 default
    dailyLossCapUsd:      50,
    maxSlippageBps:       100,      // 1% max on CEX (market orders)
    minProfitOverGasUsd:  0.5,      // at least $0.50 profit after fees
    maxOpenPositions:     5,
    allowedVenues:        ['binance'],
  },
  onchain: {
    maxTradeUsd:          50,       // even tighter on-chain — gas, MEV, slippage stack up
    dailyLossCapUsd:      25,
    maxSlippageBps:       50,       // 0.5% max — strict for MEV protection
    minProfitOverGasUsd:  2,        // gas is non-trivial on-chain
    maxOpenPositions:     3,
    allowedVenues:        ['uniswap_v3_base', 'uniswap_v3_arb', 'aerodrome_base'],
  },
}
