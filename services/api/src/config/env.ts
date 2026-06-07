/**
 * Loads environment variables before anything else reads process.env.
 * Import this FIRST in the app entrypoint (app.ts).
 *
 * Loads .env.local (preferred for local dev) then .env as a fallback.
 * Variables already present in the real environment are never overwritten.
 */
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config() // fallback to .env, does not override already-set vars
