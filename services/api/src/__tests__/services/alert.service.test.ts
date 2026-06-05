import { AlertService } from '../../services/alert.service'
import { AppError } from '../../middleware/errorHandler'

jest.mock('../../models/alert.model', () => ({
  AlertDoc: {
    find:               jest.fn(),
    create:             jest.fn(),
    findOneAndDelete:   jest.fn(),
    findOneAndUpdate:   jest.fn(),
    findByIdAndUpdate:  jest.fn(),
  },
}))

import { AlertDoc } from '../../models/alert.model'

const svc = new AlertService()

beforeEach(() => jest.clearAllMocks())

describe('AlertService.getForUser', () => {
  it('returns active alerts sorted by createdAt', async () => {
    const chain = { sort: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) }
    ;(AlertDoc.find as jest.Mock).mockReturnValue(chain)
    await svc.getForUser('user-1')
    expect(AlertDoc.find).toHaveBeenCalledWith({ userId: 'user-1', active: true })
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 })
  })
})

describe('AlertService.create', () => {
  it('creates and returns the alert', async () => {
    const alert = { _id: 'a1', userId: 'u1', coinId: 'bitcoin', condition: 'above', threshold: 60000 }
    ;(AlertDoc.create as jest.Mock).mockResolvedValue({ toObject: () => alert })
    const result = await svc.create('u1', { coinId: 'bitcoin', condition: 'above', threshold: 60000 })
    expect(result).toEqual(alert)
  })
})

describe('AlertService.delete', () => {
  it('throws 404 when alert not found', async () => {
    ;(AlertDoc.findOneAndDelete as jest.Mock).mockResolvedValue(null)
    await expect(svc.delete('u1', 'missing-id'))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns { deleted: true } on success', async () => {
    ;(AlertDoc.findOneAndDelete as jest.Mock).mockResolvedValue({ _id: 'a1' })
    const result = await svc.delete('u1', 'a1')
    expect(result).toEqual({ deleted: true })
  })
})

describe('AlertService.toggle', () => {
  it('throws 404 when alert not found', async () => {
    ;(AlertDoc.findOneAndUpdate as jest.Mock).mockResolvedValue(null)
    await expect(svc.toggle('u1', 'missing-id', false))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns updated alert', async () => {
    const updated = { _id: 'a1', active: false }
    ;(AlertDoc.findOneAndUpdate as jest.Mock).mockResolvedValue({ toObject: () => updated })
    const result = await svc.toggle('u1', 'a1', false)
    expect(result).toEqual(updated)
  })
})