import jwt from 'jsonwebtoken'
import { UserDoc, hashPassword, verifyPassword } from '../models/user.model'
import { AppError } from '../middleware/errorHandler'
import { redis } from '../config/redis'

const ACCESS_TTL  = '15m'
const REFRESH_TTL = '7d'
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60

function sign(userId: string, expiresIn: string) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn } as jwt.SignOptions)
}

async function revokeToken(token: string) {
  await redis.set(`blocklist:${token}`, '1', { EX: REFRESH_TTL_SECONDS })
}

async function isRevoked(token: string): Promise<boolean> {
  return (await redis.get(`blocklist:${token}`)) !== null
}

export class AuthService {
  async register(email: string, password: string) {
    if (!email || !password)          throw new AppError(400, 'Email and password are required')
    if (password.length < 8)          throw new AppError(400, 'Password must be at least 8 characters')
    if (!/\S+@\S+\.\S+/.test(email)) throw new AppError(400, 'Invalid email address')

    const exists = await UserDoc.findOne({ email: email.toLowerCase() })
    if (exists) throw new AppError(409, 'An account with that email already exists')

    const passwordHash = await hashPassword(password)
    const user = await UserDoc.create({ email: email.toLowerCase(), passwordHash })

    return {
      user:         { id: String(user._id), email: user.email },
      accessToken:  sign(String(user._id), ACCESS_TTL),
      refreshToken: sign(String(user._id), REFRESH_TTL),
    }
  }

  async login(email: string, password: string) {
    if (!email || !password) throw new AppError(400, 'Email and password are required')

    const user = await UserDoc.findOne({ email: email.toLowerCase() })
    const dummyHash = '$2b$12$invalidhashfortimingprotection000000000000000000000000'
    const valid = await verifyPassword(password, user?.passwordHash ?? dummyHash)

    if (!user || !valid) throw new AppError(401, 'Invalid email or password')

    return {
      user:         { id: String(user._id), email: user.email },
      accessToken:  sign(String(user._id), ACCESS_TTL),
      refreshToken: sign(String(user._id), REFRESH_TTL),
    }
  }

  async refresh(token: string) {
    if (!token) throw new AppError(400, 'Refresh token is required')

    // ✅ Reject if previously revoked
    if (await isRevoked(token)) throw new AppError(401, 'Refresh token has been revoked')

    let payload: { sub: string }
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string }
    } catch {
      throw new AppError(401, 'Invalid or expired refresh token')
    }

    const user = await UserDoc.findById(payload.sub)
    if (!user) throw new AppError(401, 'User no longer exists')

    // ✅ Rotate: revoke old token, issue new one
    await revokeToken(token)
    const newRefreshToken = sign(String(user._id), REFRESH_TTL)

    return {
      accessToken:  sign(String(user._id), ACCESS_TTL),
      refreshToken: newRefreshToken,
    }
  }

  async logout(token: string) {
    if (token) await revokeToken(token)
  }

  async me(userId: string) {
    const user = await UserDoc.findById(userId).select('-passwordHash')
    if (!user) throw new AppError(404, 'User not found')
    return { id: String(user._id), email: user.email, createdAt: user.createdAt }
  }
}