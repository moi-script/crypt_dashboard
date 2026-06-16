import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../../__tests__/helpers/db'

jest.mock('../../../../services/chartAnalysis.service', () => ({
  buildMarketPrimitives: jest.fn(async (symbol: string) => {
    if ((global as any).__throwForSymbol === symbol) {
      throw new Error('binance api unreachable')
    }
    return { meta: { symbol } } as any
  }),
}))
jest.mock('../smartMoney.strategy', () => ({ runSmartMoneyStrategy: jest.fn() }))
jest.mock('../wyckoff.strategy',    () => ({ runWyckoffStrategy:    jest.fn() }))
jest.mock('../elliott.strategy',    () => ({ runElliottStrategy:    jest.fn() }))
jest.mock('../harmonic.strategy',   () => ({ runHarmonicStrategy:   jest.fn() }))

import { chartSignalStrategy } from '../chartSignal.strategy'
import { runSmartMoneyStrategy } from '../smartMoney.strategy'
import { runWyckoffStrategy }    from '../wyckoff.strategy'
import { runElliottStrategy }    from '../elliott.strategy'
import { runHarmonicStrategy }   from '../harmonic.strategy'
import { PositionDoc } from '../../../../models/position.model'
import { DEFAULT_AGENT_CONFIG } from '../../../../config/agent.config'
import type { LoopContext } from '../../../loop/loop.types'

const skip = { signal: null, skipped: true, skip_reason: 'no setup' }

const baseCtx = (overrides: Partial<LoopContext> = {}): LoopContext => ({
  runId: 'run-1', userId: 'user-1', strategy: 'chartSignal', startedAt: Date.now(),
  contextSummary: '', walletState: { mode: 'paper', balances: {}, openPositions: 0, totalValueUsd: 5000, dailyPnlUsd: 0 },
  marketData: {}, config: { ...DEFAULT_AGENT_CONFIG }, ...overrides,
})

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

test('no qualifying signal across both symbols returns no_action', async () => {
  ;(runSmartMoneyStrategy as jest.Mock).mockReturnValue(skip)
  ;(runWyckoffStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runElliottStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runHarmonicStrategy   as jest.Mock).mockReturnValue(skip)

  const result = await chartSignalStrategy.buildContext(baseCtx())

  expect(result.metadata.deterministicDecision).toBeDefined()
  const decision = result.metadata.deterministicDecision as any
  expect(decision.intent.type).toBe('no_action')
})

test('a qualifying long signal becomes a propose_trade intent with SL/TP', async () => {
  const longSignal = {
    signal: {
      symbol: 'BTC', framework: 'SmartMoney', bias: 'long', setup_name: 'Bullish OB + BOS',
      entry_zone: { high: 51000, low: 50000 }, stop_loss: 49000,
      take_profit_levels: [53000, 54000, 55000], risk_reward: 2.5, confidence: 80,
      invalidation: 'x', reasoning: 'Strong bullish structure break', confluence_factors: [],
      generated_at: new Date().toISOString(),
    },
    skipped: false,
  }
  ;(runSmartMoneyStrategy as jest.Mock).mockReturnValue(longSignal)
  ;(runWyckoffStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runElliottStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runHarmonicStrategy   as jest.Mock).mockReturnValue(skip)

  const result = await chartSignalStrategy.buildContext(baseCtx())

  const decision = result.metadata.deterministicDecision as any
  expect(decision.intent.type).toBe('propose_trade')
  expect(decision.intent.tokenOut).toBe('BTC')
  expect(decision.intent.tokenIn).toBe('USDC')
  expect(decision.intent.stopLossPrice).toBe(49000)
  expect(decision.intent.takeProfitPrice).toBe(53000)
  expect(decision.intent.framework).toBe('SmartMoney')
  expect(decision.confidence).toBe(80)
})

test('a signal below minSignalConfidence is skipped', async () => {
  const weakSignal = {
    signal: {
      symbol: 'BTC', framework: 'SmartMoney', bias: 'long', setup_name: 'Weak setup',
      entry_zone: { high: 51000, low: 50000 }, stop_loss: 49000,
      take_profit_levels: [53000], risk_reward: 2.5, confidence: 40,
      invalidation: 'x', reasoning: 'Weak structure', confluence_factors: [],
      generated_at: new Date().toISOString(),
    },
    skipped: false,
  }
  ;(runSmartMoneyStrategy as jest.Mock).mockReturnValue(weakSignal)
  ;(runWyckoffStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runElliottStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runHarmonicStrategy   as jest.Mock).mockReturnValue(skip)

  const result = await chartSignalStrategy.buildContext(baseCtx({ config: { ...DEFAULT_AGENT_CONFIG, minSignalConfidence: 55 } }))

  const decision = result.metadata.deterministicDecision as any
  expect(decision.intent.type).toBe('no_action')
})

test('a short-biased signal is skipped (no shorting support)', async () => {
  const shortSignal = {
    signal: {
      symbol: 'BTC', framework: 'SmartMoney', bias: 'short', setup_name: 'Bearish OB + BOS',
      entry_zone: { high: 51000, low: 50000 }, stop_loss: 52000,
      take_profit_levels: [48000], risk_reward: 2.5, confidence: 80,
      invalidation: 'x', reasoning: 'Strong bearish structure break', confluence_factors: [],
      generated_at: new Date().toISOString(),
    },
    skipped: false,
  }
  ;(runSmartMoneyStrategy as jest.Mock).mockReturnValue(shortSignal)
  ;(runWyckoffStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runElliottStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runHarmonicStrategy   as jest.Mock).mockReturnValue(skip)

  const result = await chartSignalStrategy.buildContext(baseCtx())

  const decision = result.metadata.deterministicDecision as any
  expect(decision.intent.type).toBe('no_action')
})

test('skips a symbol that already has an open position', async () => {
  await PositionDoc.create({
    positionId: 'pos-existing', userId: 'user-1', mode: 'paper', tokenIn: 'USDC', tokenOut: 'BTC',
    entryAmountUsd: 100, entryPrice: 50000, entryAt: new Date(), isOpen: true,
    strategy: 'chartSignal', runId: 'run-0',
  })

  const longSignal = {
    signal: {
      symbol: 'BTC', framework: 'SmartMoney', bias: 'long', setup_name: 'Bullish OB + BOS',
      entry_zone: { high: 51000, low: 50000 }, stop_loss: 49000,
      take_profit_levels: [53000], risk_reward: 2.5, confidence: 80,
      invalidation: 'x', reasoning: 'Strong bullish structure break', confluence_factors: [],
      generated_at: new Date().toISOString(),
    },
    skipped: false,
  }
  // BTC already has an open position, so only ETH's primitives ever reach the
  // strategy functions. Mock SmartMoney to only return the long signal for
  // BTC's primitives (which the loop should never reach) and skip otherwise,
  // so ETH (the only symbol actually evaluated) gets no qualifying signal.
  ;(runSmartMoneyStrategy as jest.Mock).mockImplementation((primitives: any) =>
    primitives?.meta?.symbol === 'BTCUSDT' ? longSignal : skip,
  )
  ;(runWyckoffStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runElliottStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runHarmonicStrategy   as jest.Mock).mockReturnValue(skip)

  const result = await chartSignalStrategy.buildContext(baseCtx())

  const decision = result.metadata.deterministicDecision as any
  expect(decision.intent.type).toBe('no_action')
})

test('a primitives fetch failure for one symbol does not crash the whole tick', async () => {
  ;(global as any).__throwForSymbol = 'BTCUSDT'

  const longSignal2 = {
    signal: {
      symbol: 'ETHUSDT', framework: 'SmartMoney', bias: 'long', setup_name: 'Bullish OB + BOS',
      entry_zone: { high: 3100, low: 3000 }, stop_loss: 2900,
      take_profit_levels: [3300], risk_reward: 2.5, confidence: 80,
      invalidation: 'x', reasoning: 'Strong bullish structure break', confluence_factors: [],
      generated_at: new Date().toISOString(),
    },
    skipped: false,
  }
  ;(runSmartMoneyStrategy as jest.Mock).mockReturnValue(longSignal2)
  ;(runWyckoffStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runElliottStrategy    as jest.Mock).mockReturnValue(skip)
  ;(runHarmonicStrategy   as jest.Mock).mockReturnValue(skip)

  let result: any
  try {
    result = await chartSignalStrategy.buildContext(baseCtx())
  } finally {
    delete (global as any).__throwForSymbol
  }

  expect(result).toBeDefined()
  const decision = result.metadata.deterministicDecision as any
  expect(decision).toBeDefined()
  expect(result.contextSummary).toContain('BTC: skipped — primitives fetch failed: binance api unreachable')
  // ETH should still have been evaluated and acted upon since its primitives fetch succeeded
  expect(decision.intent.type).toBe('propose_trade')
  expect(decision.intent.tokenOut).toBe('ETH')
})
