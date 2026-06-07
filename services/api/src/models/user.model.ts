import { Schema, model } from 'mongoose'
import bcrypt from 'bcrypt'

export interface IUser {
  email:        string
  passwordHash: string
  createdAt:    Date
}

const UserSchema = new Schema<IUser>({
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true })

// `unique: true` on the email field above already creates the index — no
// separate UserSchema.index({ email: 1 }) needed (it would be a duplicate).

export const UserDoc = model<IUser>('User', UserSchema)

const SALT_ROUNDS = 12

export const hashPassword   = (plain: string)              => bcrypt.hash(plain, SALT_ROUNDS)
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash)