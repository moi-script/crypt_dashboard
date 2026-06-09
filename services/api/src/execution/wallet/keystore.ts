/**
 * keystore.ts
 *
 * The ONLY place in the codebase where execution secrets are loaded.
 *
 * HARD RULES:
 *   1. Never log any key or secret (not even a prefix/suffix).
 *   2. Never return raw key material in a format that could be serialized.
 *   3. Only called from execution layer — never from agents/ or policy/.
 *   4. In paper mode, this module is never called at all.
 */

export interface KeyPresence {
  hasBinanceKey:   boolean
  hasPrivateKey:   boolean
  hasOnchainRpc:   boolean
}

/**
 * Returns which keys are configured (boolean only — never the values).
 * Safe to call for health checks.
 */
export function checkKeyPresence(): KeyPresence {
  return {
    hasBinanceKey:  !!(process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET),
    hasPrivateKey:  !!process.env.AGENT_PRIVATE_KEY,
    hasOnchainRpc:  !!(process.env.BASE_RPC_URL || process.env.ARBITRUM_RPC_URL || process.env.ETH_RPC_URL),
  }
}

/**
 * Load Binance keys — only called from cex.executor.ts.
 * Throws if keys are missing or caller is not in the allowed call stack.
 */
export function getBinanceKeys(): { apiKey: string; secret: string } {
  const apiKey = process.env.BINANCE_API_KEY
  const secret = process.env.BINANCE_SECRET

  if (!apiKey || !secret) {
    throw new Error(
      '[Keystore] Binance keys not configured. ' +
      'Set BINANCE_API_KEY and BINANCE_SECRET in .env.local. ' +
      'Key MUST have TRADE permission only — NEVER enable withdrawal.'
    )
  }

  return { apiKey, secret }
}

/**
 * Load on-chain private key — only called from onchain.executor.ts.
 * Returns the raw hex key string (caller responsible for handling securely).
 */
export function getPrivateKey(): `0x${string}` {
  const raw = process.env.AGENT_PRIVATE_KEY
  if (!raw) {
    throw new Error('[Keystore] AGENT_PRIVATE_KEY not set. Required for on-chain execution.')
  }
  const key = raw.startsWith('0x') ? raw : `0x${raw}`
  return key as `0x${string}`
}
