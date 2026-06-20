/**
 * act.tools.ts
 *
 * Tools that produce *intents* — they NEVER execute directly.
 * When the LLM calls one of these, the handler returns a structured
 * intent object. The policy engine picks that up and passes it to
 * risk/ → execution/ for validation and (possibly) execution.
 *
 * Key principle: these handlers do zero side effects. They just
 * return a well-typed Intent that the rest of the pipeline can validate.
 */

import type { RegisteredTool, ToolContext } from './tool.types'
import type { TradeIntent, AlertIntent, RebalanceIntent, NoActionIntent } from '../loop/loop.types'

// ── propose_trade ─────────────────────────────────────────────────────────────

const proposeTradeTool: RegisteredTool = {
  category: 'act',
  def: {
    name: 'propose_trade',
    description:
      'Propose a swap/trade between two tokens. This does NOT execute the trade — ' +
      'it creates an intent that will be reviewed by the risk engine first. ' +
      'Use this only when you have clear, data-backed rationale.',
    parameters: {
      type: 'object',
      properties: {
        tokenIn: {
          type: 'string',
          description: 'Token to sell / swap from (symbol, e.g. "USDC")',
        },
        tokenOut: {
          type: 'string',
          description: 'Token to buy / swap to (symbol, e.g. "ETH")',
        },
        amountUsd: {
          type: 'number',
          description: 'Trade size in USD equivalent. Must be within risk limits.',
        },
        maxSlippageBps: {
          type: 'number',
          description: 'Maximum acceptable slippage in basis points. Default 50 (0.5%).',
        },
        rationale: {
          type: 'string',
          description:
            'One-sentence explanation citing specific data: which signals, which numbers, why now.',
        },
        venue: {
          type: 'string',
          description: 'Preferred execution venue, e.g. "binance" or "uniswap_v3_base". Optional.',
        },
        stopLossPrice: {
          type: 'number',
          description:
            'Price at which the position is automatically closed at a loss. ' +
            'For longs: below entry. For shorts: above entry. ' +
            'Always set this — a trade without a stop is unmanaged risk.',
        },
        takeProfitPrice: {
          type: 'number',
          description:
            'First take-profit target. When price reaches this level, 50% of the ' +
            'position is closed and the stop-loss moves to break-even.',
        },
        takeProfitPrice2: {
          type: 'number',
          description:
            'Second take-profit target. Used after the TP1 50% scale-out. ' +
            'When hit, 90% of the remaining position closes and a 10% runner ' +
            'stays open with a 5% trailing stop.',
        },
        bias: {
          type: 'string',
          enum: ['long', 'short'],
          description:
            'Trade direction. "long" = buying tokenOut expecting it to rise. ' +
            '"short" = currently unsupported in paper spot mode. Default: "long".',
        },
      },
      required: ['tokenIn', 'tokenOut', 'amountUsd', 'rationale'],
    },
  },
  handler: async (args, _ctx: ToolContext): Promise<TradeIntent> => {
    return {
      type:             'propose_trade',
      tokenIn:          args.tokenIn          as string,
      tokenOut:         args.tokenOut         as string,
      amountUsd:        args.amountUsd        as number,
      maxSlippageBps:   (args.maxSlippageBps  as number) ?? 50,
      rationale:        args.rationale        as string,
      venue:            args.venue            as string | undefined,
      stopLossPrice:    args.stopLossPrice    as number | undefined,
      takeProfitPrice:  args.takeProfitPrice  as number | undefined,
      takeProfitPrice2: args.takeProfitPrice2 as number | undefined,
      bias:             (args.bias as 'long' | 'short' | undefined) ?? 'long',
    }
  },
}

// ── set_alert ─────────────────────────────────────────────────────────────────

const setAlertTool: RegisteredTool = {
  category: 'act',
  def: {
    name: 'set_alert',
    description:
      'Create a price alert for a coin. The alert will fire via WebSocket when ' +
      'the condition is met. Use this as an alternative to trading when you want ' +
      'to monitor rather than act immediately.',
    parameters: {
      type: 'object',
      properties: {
        coinId: {
          type: 'string',
          description: 'CoinGecko coin ID, e.g. "ethereum"',
        },
        condition: {
          type: 'string',
          enum: ['above', 'below', 'pct_change'],
          description: '"above" or "below" a threshold, or "pct_change" from current price.',
        },
        threshold: {
          type: 'number',
          description:
            'For "above"/"below": price in USD. For "pct_change": percentage (e.g. 5 = 5%).',
        },
        rationale: {
          type: 'string',
          description: 'Why this alert level matters.',
        },
      },
      required: ['coinId', 'condition', 'threshold', 'rationale'],
    },
  },
  handler: async (args, _ctx: ToolContext): Promise<AlertIntent> => {
    return {
      type:      'set_alert',
      coinId:    args.coinId    as string,
      condition: args.condition as 'above' | 'below' | 'pct_change',
      threshold: args.threshold as number,
      rationale: args.rationale as string,
    }
  },
}

// ── rebalance ─────────────────────────────────────────────────────────────────

const rebalanceTool: RegisteredTool = {
  category: 'act',
  def: {
    name: 'rebalance',
    description:
      'Propose a portfolio rebalance to target weights. ' +
      'The risk engine will cap each position to risk limits. ' +
      'Only available in paper mode or with manual approval in live mode.',
    parameters: {
      type: 'object',
      properties: {
        targetWeights: {
          type: 'object',
          description:
            'Map of token symbol → target percentage of portfolio. Must sum to 100. ' +
            'Example: { "USDC": 60, "ETH": 30, "BTC": 10 }',
        },
        rationale: {
          type: 'string',
          description: 'Why this allocation makes sense given current market conditions.',
        },
      },
      required: ['targetWeights', 'rationale'],
    },
  },
  handler: async (args, _ctx: ToolContext): Promise<RebalanceIntent> => {
    const weights = args.targetWeights as Record<string, number>
    const total   = Object.values(weights).reduce((s, v) => s + v, 0)
    if (Math.abs(total - 100) > 1) {
      throw new Error(`targetWeights must sum to 100, got ${total}`)
    }
    return {
      type:          'rebalance',
      targetWeights: weights,
      rationale:     args.rationale as string,
    }
  },
}

// ── no_action ─────────────────────────────────────────────────────────────────

const noActionTool: RegisteredTool = {
  category: 'act',
  def: {
    name: 'no_action',
    description:
      'Explicitly signal that no trade or alert is warranted right now. ' +
      'Use this when conditions are uncertain, data is insufficient, or the ' +
      'expected profit does not justify fees. Always preferred over a bad trade.',
    parameters: {
      type: 'object',
      properties: {
        rationale: {
          type: 'string',
          description: 'Why no action is the right call.',
        },
      },
      required: ['rationale'],
    },
  },
  handler: async (args, _ctx: ToolContext): Promise<NoActionIntent> => {
    return {
      type:      'no_action',
      rationale: args.rationale as string,
    }
  },
}

// ── Export ────────────────────────────────────────────────────────────────────

export const ACT_TOOLS: RegisteredTool[] = [
  proposeTradeTool,
  setAlertTool,
  rebalanceTool,
  noActionTool,
]
