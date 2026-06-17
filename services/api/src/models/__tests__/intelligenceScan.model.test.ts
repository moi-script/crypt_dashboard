import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import {
  saveScan,
  getLatestScan,
  getScanById,
  listScans,
} from '../../services/intelligenceScan.repository'
import { IntelligenceScan } from '../../agents/chartAnalysis.types'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

function makeScan(overrides: Partial<IntelligenceScan> = {}): IntelligenceScan {
  return {
    scan_id: 'scan-1',
    generated_at: '2026-06-16T12:00:00.000Z',
    btc_context: {
      regime: 'trending_up',
      bias: 'long',
      signal_fired_at: '2026-06-16T11:55:00.000Z',
      signal_type: 'BOS',
      dominance: {
        btc_dominance: 52, eth_dominance: 17, others_dominance: 31,
        btc_d_trend: 'rising', market_phase: 'btc_season', sector_leaders: ['L1'],
      },
      minutes_since_signal: 5,
    },
    dominance: {
      btc_dominance: 52, eth_dominance: 17, others_dominance: 31,
      btc_d_trend: 'rising', market_phase: 'btc_season', sector_leaders: ['L1'],
    },
    market_phase: 'btc_season',
    coins: [{ coin: 'SOL', symbol: 'SOLUSDT', opportunity_score: 0.8 } as any],
    total_analyzed: 12,
    windows_open: 3,
    top_opportunities: [{ coin: 'SOL', symbol: 'SOLUSDT', opportunity_score: 0.8 } as any],
    ...overrides,
  }
}

test('saveScan persists and getScanById round-trips the scan shape', async () => {
  const scan = makeScan()
  const ok = await saveScan(scan)
  expect(ok).toBe(true)

  const fetched = await getScanById('scan-1')
  expect(fetched).not.toBeNull()
  expect(fetched!.scan_id).toBe('scan-1')
  expect(fetched!.generated_at).toBe('2026-06-16T12:00:00.000Z') // Date → ISO string
  expect(fetched!.market_phase).toBe('btc_season')
  expect(fetched!.coins).toHaveLength(1)
  expect(fetched!.coins[0].coin).toBe('SOL')
  expect(fetched!.btc_context.bias).toBe('long')
})

test('getLatestScan returns the most recently generated scan', async () => {
  await saveScan(makeScan({ scan_id: 'older', generated_at: '2026-06-16T10:00:00.000Z' }))
  await saveScan(makeScan({ scan_id: 'newer', generated_at: '2026-06-16T14:00:00.000Z' }))

  const latest = await getLatestScan()
  expect(latest!.scan_id).toBe('newer')
})

test('listScans returns lightweight metadata newest-first', async () => {
  await saveScan(makeScan({ scan_id: 'a', generated_at: '2026-06-16T10:00:00.000Z' }))
  await saveScan(makeScan({ scan_id: 'b', generated_at: '2026-06-16T14:00:00.000Z' }))

  const history = await listScans(10)
  expect(history.map(h => h.scan_id)).toEqual(['b', 'a'])
  expect(history[0].coin_count).toBe(1)
  expect(history[0].btc_bias).toBe('long')
  // Metadata only — no heavy nested payloads
  expect((history[0] as any).coins).toBeUndefined()
})
