import { AuthService } from '../../services/auth.service'
import { AppError } from '../../middleware/errorHandler'

// Mock all external dependencies
jest.mock('../../models/user.model', () => ({
  UserDoc: {
    findOne:   jest.fn(),
    findById:  jest.fn(),
    create:    jest.fn(),
  },
  hashPassword:   jest.fn(),
  verifyPassword: jest.fn(),
}))

jest.mock('../../config/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
  },
}))

jest.mock('jsonwebtoken', () => ({
  sign:   jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn(),
}))

import { UserDoc, hashPassword, verifyPassword } from '../../models/user.model'
import { redis } from '../../config/redis'
import jwt from 'jsonwebtoken'

const svc = new AuthService()

beforeEach(() => jest.clearAllMocks())

describe('AuthService.register', () => {
  it('throws 409 when email already exists', async () => {
    ;(UserDoc.findOne as jest.Mock).mockResolvedValue({ email: 'existing@example.com' })
    await expect(svc.register('existing@example.com', 'password123'))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('throws 400 for invalid email format', async () => {
    await expect(svc.register('bad-email', 'password123'))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 for short password', async () => {
    await expect(svc.register('user@example.com', 'short'))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('returns user + tokens on success', async () => {
    ;(UserDoc.findOne as jest.Mock).mockResolvedValue(null)
    ;(hashPassword as jest.Mock).mockResolvedValue('hashed')
    ;(UserDoc.create as jest.Mock).mockResolvedValue({
      _id: 'user-id-1', email: 'user@example.com',
    })

    const result = await svc.register('user@example.com', 'password123')
    expect(result.user.email).toBe('user@example.com')
    expect(result.accessToken).toBe('mock-token')
    expect(result.refreshToken).toBe('mock-token')
  })
})

describe('AuthService.login', () => {
  it('throws 401 for wrong password', async () => {
    ;(UserDoc.findOne as jest.Mock).mockResolvedValue({
      _id: 'id', email: 'user@example.com', passwordHash: 'hash',
    })
    ;(verifyPassword as jest.Mock).mockResolvedValue(false)
    await expect(svc.login('user@example.com', 'wrongpass'))
      .rejects.toMatchObject({ statusCode: 401 })
  })

  it('throws 401 when user does not exist (still runs bcrypt)', async () => {
    ;(UserDoc.findOne as jest.Mock).mockResolvedValue(null)
    ;(verifyPassword as jest.Mock).mockResolvedValue(false)
    await expect(svc.login('ghost@example.com', 'password123'))
      .rejects.toMatchObject({ statusCode: 401 })
    // bcrypt must still have been called (timing attack protection)
    expect(verifyPassword).toHaveBeenCalled()
  })

  it('returns tokens on valid credentials', async () => {
    ;(UserDoc.findOne as jest.Mock).mockResolvedValue({
      _id: 'user-id', email: 'user@example.com', passwordHash: 'hash',
    })
    ;(verifyPassword as jest.Mock).mockResolvedValue(true)
    const result = await svc.login('user@example.com', 'password123')
    expect(result.accessToken).toBe('mock-token')
  })
})

describe('AuthService.refresh', () => {
  it('throws 401 if token is revoked', async () => {
    ;(redis.get as jest.Mock).mockResolvedValue('1')
    await expect(svc.refresh('revoked-token'))
      .rejects.toMatchObject({ statusCode: 401, message: 'Refresh token has been revoked' })
  })

  it('throws 401 if token is invalid', async () => {
    ;(redis.get as jest.Mock).mockResolvedValue(null)
    ;(jwt.verify as jest.Mock).mockImplementation(() => { throw new Error('bad') })
    await expect(svc.refresh('bad-token'))
      .rejects.toMatchObject({ statusCode: 401 })
  })

  it('rotates token and returns new accessToken', async () => {
    ;(redis.get as jest.Mock).mockResolvedValue(null)
    ;(jwt.verify as jest.Mock).mockReturnValue({ sub: 'user-id' })
    ;(UserDoc.findById as jest.Mock).mockResolvedValue({ _id: 'user-id' })
    ;(redis.set as jest.Mock).mockResolvedValue('OK')

    const result = await svc.refresh('valid-refresh-token')
    expect(result.accessToken).toBe('mock-token')
    expect(result.refreshToken).toBe('mock-token')
    // old token must be blocklisted
    expect(redis.set).toHaveBeenCalledWith(
      'blocklist:valid-refresh-token', '1', expect.any(Object)
    )
  })
})

describe('AuthService.logout', () => {
  it('adds the token to the blocklist', async () => {
    ;(redis.set as jest.Mock).mockResolvedValue('OK')
    await svc.logout('some-refresh-token')
    expect(redis.set).toHaveBeenCalledWith(
      'blocklist:some-refresh-token', '1', expect.any(Object)
    )
  })

  it('does nothing when token is empty string', async () => {
    await svc.logout('')
    expect(redis.set).not.toHaveBeenCalled()
  })
})