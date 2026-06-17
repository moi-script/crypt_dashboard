import { connectTestDb, clearTestDb, disconnectTestDb } from '../../__tests__/helpers/db'
import { listOpportunities, getOpportunitySummary } from '../opportunity.controller'
import { OpportunityDoc } from '../../models/opportunity.model'

beforeAll(connectTestDb)
afterEach(clearTestDb)
afterAll(disconnectTestDb)

function mockRes() {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

async function seedOpp(userId: string, id: string) {
  await OpportunityDoc.create({
    opportunityId: id,
    userId,
    type: 'yield_anomaly',
    strategy: 'yieldHunter',
    runId: 'r',
    title: 't',
    detail: 'd',
    asset: 'USDC',
    score: 60,
    acted: false,
    detectedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
  })
}

test('listOpportunities returns only the caller\'s opportunities', async () => {
  await seedOpp('user-a', 'opp-a')
  await seedOpp('user-b', 'opp-b')

  const req: any = { userId: 'user-a', query: {} }
  const res = mockRes()
  await listOpportunities(req, res, jest.fn())

  const payload = res.json.mock.calls[0][0]
  expect(payload.count).toBe(1)
  expect(payload.opportunities[0].userId).toBe('user-a')
})

test('getOpportunitySummary counts only the caller\'s opportunities', async () => {
  await seedOpp('user-a', 'opp-a1')
  await seedOpp('user-a', 'opp-a2')
  await seedOpp('user-b', 'opp-b1')

  const req: any = { userId: 'user-a' }
  const res = mockRes()
  await getOpportunitySummary(req, res, jest.fn())

  const payload = res.json.mock.calls[0][0]
  expect(payload.total).toBe(2)
})
