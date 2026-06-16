import { connectTestDb, clearTestDb, disconnectTestDb } from '../../../__tests__/helpers/db'
import { runPositionMonitorSweep } from '../positionMonitor'
import { PositionDoc, OrderDoc } from '../../../models/position.model'
import { getOrCreateWallet } from '../../../services/paperWallet.service'
import { PaperWalletDoc } from '../../../models/paperWallet.model'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

async function seedWalletHoldingBtc(userId: string) {
  await getOrCreateWallet(userId)
  await PaperWalletDoc.updateOne({ userId }, { $set: {
    balances: [
      { symbol: 'USDC', amount: 4000, valueUsd: 4000, avgCostUsd: 1, updatedAt: new Date() },
      { symbol: 'BTC',  amount: 0.02, valueUsd: 1000, avgCostUsd: 50000, updatedAt: new Date() },
    ],
  } })
}

test('closes a position and reduces wallet PnL when price hits stop loss', async () => {
  await seedWalletHoldingBtc('user-sl')
  await PositionDoc.create({
    positionId: 'pos-sl', userId: 'user-sl', mode: 'paper', tokenIn: 'USDC', tokenOut: 'BTC',
    entryAmountUsd: 1000, entryPrice: 50000, entryAt: new Date(), isOpen: true,
    strategy: 'chartSignal', runId: 'run-1', stopLossPrice: 49000, takeProfitPrice: 53000,
  })

  global.fetch = jest.fn(async (url: string) => {
    if (url.includes('bitcoin')) return { json: async () => ({ bitcoin: { usd: 48500 } }) } as any
    return { json: async () => ({ 'usd-coin': { usd: 1 } }) } as any
  }) as any

  await runPositionMonitorSweep()

  const position = await PositionDoc.findOne({ positionId: 'pos-sl' }).lean()
  expect(position?.isOpen).toBe(false)
  expect(position?.exitPrice).toBe(48500)
  expect(position?.realizedPnlUsd).toBeLessThan(0)

  const wallet = await PaperWalletDoc.findOne({ userId: 'user-sl' }).lean()
  expect(wallet?.realizedPnlUsd).toBeLessThan(0)

  const orders = await OrderDoc.find({ positionId: 'pos-sl' }).lean()
  expect(orders).toHaveLength(1)
})

test('closes a position and increases wallet PnL when price hits take profit', async () => {
  await getOrCreateWallet('user-tp')
  await PaperWalletDoc.updateOne({ userId: 'user-tp' }, { $set: {
    balances: [
      { symbol: 'USDC', amount: 4000, valueUsd: 4000, avgCostUsd: 1, updatedAt: new Date() },
      // valueUsd reflects the position's value at the take-profit exit price ($53500 * 0.02 BTC)
      // so executePaper's balance check doesn't reject the close as the live price moves the
      // mark-to-market value above the stale $50000-entry-implied $1000.
      { symbol: 'BTC',  amount: 0.02, valueUsd: 1100, avgCostUsd: 50000, updatedAt: new Date() },
    ],
  } })
  await PositionDoc.create({
    positionId: 'pos-tp', userId: 'user-tp', mode: 'paper', tokenIn: 'USDC', tokenOut: 'BTC',
    entryAmountUsd: 1000, entryPrice: 50000, entryAt: new Date(), isOpen: true,
    strategy: 'chartSignal', runId: 'run-1', stopLossPrice: 49000, takeProfitPrice: 53000,
  })

  global.fetch = jest.fn(async (url: string) => {
    if (url.includes('bitcoin')) return { json: async () => ({ bitcoin: { usd: 53500 } }) } as any
    return { json: async () => ({ 'usd-coin': { usd: 1 } }) } as any
  }) as any

  await runPositionMonitorSweep()

  const position = await PositionDoc.findOne({ positionId: 'pos-tp' }).lean()
  expect(position?.isOpen).toBe(false)
  expect(position?.exitPrice).toBe(53500)
  expect(position?.realizedPnlUsd).toBeGreaterThan(0)

  const wallet = await PaperWalletDoc.findOne({ userId: 'user-tp' }).lean()
  expect(wallet?.realizedPnlUsd).toBeGreaterThan(0)
})

test('leaves a position open when price is between stop loss and take profit', async () => {
  await seedWalletHoldingBtc('user-hold')
  await PositionDoc.create({
    positionId: 'pos-hold', userId: 'user-hold', mode: 'paper', tokenIn: 'USDC', tokenOut: 'BTC',
    entryAmountUsd: 1000, entryPrice: 50000, entryAt: new Date(), isOpen: true,
    strategy: 'chartSignal', runId: 'run-1', stopLossPrice: 49000, takeProfitPrice: 53000,
  })

  global.fetch = jest.fn(async (url: string) => {
    if (url.includes('bitcoin')) return { json: async () => ({ bitcoin: { usd: 50200 } }) } as any
    return { json: async () => ({ 'usd-coin': { usd: 1 } }) } as any
  }) as any

  await runPositionMonitorSweep()

  const position = await PositionDoc.findOne({ positionId: 'pos-hold' }).lean()
  expect(position?.isOpen).toBe(true)
})

test('continues closing remaining positions when one position fails to close', async () => {
  await seedWalletHoldingBtc('user-fail')
  await seedWalletHoldingBtc('user-ok')
  await PositionDoc.create({
    positionId: 'pos-fail', userId: 'user-fail', mode: 'paper', tokenIn: 'USDC', tokenOut: 'BTC',
    entryAmountUsd: 1000, entryPrice: 50000, entryAt: new Date(), isOpen: true,
    strategy: 'chartSignal', runId: 'run-1', stopLossPrice: 49000, takeProfitPrice: 53000,
  })
  await PositionDoc.create({
    positionId: 'pos-ok', userId: 'user-ok', mode: 'paper', tokenIn: 'USDC', tokenOut: 'BTC',
    entryAmountUsd: 1000, entryPrice: 50000, entryAt: new Date(), isOpen: true,
    strategy: 'chartSignal', runId: 'run-1', stopLossPrice: 49000, takeProfitPrice: 53000,
  })

  global.fetch = jest.fn(async (url: string) => {
    if (url.includes('bitcoin')) return { json: async () => ({ bitcoin: { usd: 48500 } }) } as any
    return { json: async () => ({ 'usd-coin': { usd: 1 } }) } as any
  }) as any

  const originalUpdateOne = PositionDoc.updateOne.bind(PositionDoc)
  const updateOneSpy = jest.spyOn(PositionDoc, 'updateOne').mockImplementation(((filter: any, ...rest: any[]) => {
    if (filter?.positionId === 'pos-fail') {
      return Promise.reject(new Error('simulated transient DB error'))
    }
    return originalUpdateOne(filter, ...rest)
  }) as any)

  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

  await expect(runPositionMonitorSweep()).resolves.not.toThrow()

  updateOneSpy.mockRestore()
  warnSpy.mockRestore()

  const failedPosition = await PositionDoc.findOne({ positionId: 'pos-fail' }).lean()
  expect(failedPosition?.isOpen).toBe(true)

  const okPosition = await PositionDoc.findOne({ positionId: 'pos-ok' }).lean()
  expect(okPosition?.isOpen).toBe(false)
  expect(okPosition?.exitPrice).toBe(48500)
})

test('ignores positions without a stop loss or take profit set', async () => {
  await seedWalletHoldingBtc('user-legacy')
  await PositionDoc.create({
    positionId: 'pos-legacy', userId: 'user-legacy', mode: 'paper', tokenIn: 'USDC', tokenOut: 'BTC',
    entryAmountUsd: 1000, entryPrice: 50000, entryAt: new Date(), isOpen: true,
    strategy: 'yieldHunter', runId: 'run-1',
  })

  global.fetch = jest.fn(async () => ({ json: async () => ({ bitcoin: { usd: 1 } }) })) as any

  await runPositionMonitorSweep()

  const position = await PositionDoc.findOne({ positionId: 'pos-legacy' }).lean()
  expect(position?.isOpen).toBe(true)
})
