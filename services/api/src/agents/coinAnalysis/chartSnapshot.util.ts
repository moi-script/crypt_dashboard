import { ohlcvIngest }          from '@/read/ingestion/ohlcv.ingest'
import { extractZigZagPivots }  from '@/agents/skills/structure.skill'
import type { ChartSnapshot, ChartOverlay } from '@/agents/loop/loop.types'
import type { MarketPrimitives }            from '@/agents/chartAnalysis.types'
import type { TradeSignal }                 from '@/agents/policy/strategies/strategy.types'

export async function buildChartSnapshot(
  symbol:        string,
  binanceSymbol: string,
  primitives:    MarketPrimitives,
  signal:        TradeSignal,
): Promise<ChartSnapshot> {
  let trendlines: ChartOverlay['trendlines'] = []
  try {
    const candleMap = await ohlcvIngest.fetchMultiTimeframe(binanceSymbol, ['4h'], 200)
    const candles4H = candleMap['4h'] ?? []
    const pivots    = extractZigZagPivots(candles4H)

    const highs = pivots.filter(p => p.type === 'high').slice(-4)
    const lows  = pivots.filter(p => p.type === 'low').slice(-4)

    if (highs.length >= 2) {
      const h1 = highs[highs.length - 2]
      const h2 = highs[highs.length - 1]
      trendlines.push({
        p1:        { time: h1.timestamp, price: h1.price },
        p2:        { time: h2.timestamp, price: h2.price },
        direction: h2.price < h1.price ? 'down' : 'up',
      })
    }
    if (lows.length >= 2) {
      const l1 = lows[lows.length - 2]
      const l2 = lows[lows.length - 1]
      trendlines.push({
        p1:        { time: l1.timestamp, price: l1.price },
        p2:        { time: l2.timestamp, price: l2.price },
        direction: l2.price > l1.price ? 'up' : 'down',
      })
    }
  } catch { /* trendlines are best-effort */ }

  const supportResistance: ChartOverlay['supportResistance'] =
    (primitives.structure?.key_levels ?? []).slice(0, 8).map(z => ({
      price:    z.price,
      type:     z.type as 'support' | 'resistance',
      strength: z.strength,
    }))

  const overlays: ChartOverlay = { supportResistance, trendlines }

  if (signal.framework === 'SmartMoney' && primitives.smart_money) {
    overlays.orderBlocks = primitives.smart_money.order_blocks.slice(0, 5).map(ob => ({
      high:   ob.price_high,
      low:    ob.price_low,
      type:   ob.type as 'bullish' | 'bearish',
      status: ob.status,
    }))
  }
  if (signal.framework === 'Wyckoff' && primitives.wyckoff) {
    overlays.wyckoffRange = {
      high:  primitives.wyckoff.range_high,
      low:   primitives.wyckoff.range_low,
      phase: primitives.wyckoff.phase,
    }
  }
  if (signal.framework === 'ElliottWave' && primitives.elliott) {
    overlays.elliottPivots = (primitives.elliott.pivots ?? []).map((price, i) => ({
      price,
      timestamp: primitives.elliott!.pivot_timestamps[i] ?? 0,
      waveLabel: `W${i + 1}`,
    }))
  }
  if (signal.framework === 'Harmonic' && primitives.harmonics) {
    const h = primitives.harmonics
    overlays.harmonicPattern = {
      name:     h.name,
      prz_high: h.prz_high,
      prz_low:  h.prz_low,
      xabcd:    { X: h.xabcd.X,    A: h.xabcd.A,    B: h.xabcd.B,    C: h.xabcd.C,    D: h.xabcd.D    },
      xabcd_ts: { X: h.xabcd.X_ts, A: h.xabcd.A_ts, B: h.xabcd.B_ts, C: h.xabcd.C_ts, D: h.xabcd.D_ts },
    }
  }

  return {
    symbol,
    binanceSymbol,
    framework:        signal.framework,
    snapshotAt:       new Date(),
    entryZone:        signal.entry_zone,
    stopLoss:         signal.stop_loss,
    takeProfitLevels: signal.take_profit_levels,
    confidence:       signal.confidence,
    overlays,
  }
}
