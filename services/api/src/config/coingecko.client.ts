/**
 * CoinGecko API — Base HTTP Client
 * Demo Plan: https://api.coingecko.com/api/v3
 * Auth: x-cg-demo-api-key header (preferred over query param)
 * Rate limit: 30 calls/min
 *
 * Error codes:
 *  401   — no API key
 *  10002 — wrong auth method / key missing
 *  10005 — endpoint needs higher plan
 *  10011 — using Pro base URL on Demo key (wrong base URL)
 *  429   — rate limit exceeded
 *
 * Attribution required: "Data provided by CoinGecko"
 * Brand kit: https://www.coingecko.com/en/branding
 */

export const CG_BASE_URL = 'https://api.coingecko.com/api/v3'

// Set in your environment: COINGECKO_API_KEY=CG-xxxxxxxxxxxxxxxxxxxx
const API_KEY = process.env.COINGECKO_API_KEY ?? ''

if (!API_KEY) {
  console.warn(
    '[CoinGecko] No COINGECKO_API_KEY found. Running keyless (~5 req/min, unstable).',
  )
}

export class CoinGeckoError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: number | null,
    message: string,
  ) {
    super(message)
    this.name = 'CoinGeckoError'
  }
}

export async function cgFetch<T>(
  path: string,
  params: Record<string, string | number | boolean> = {},
): Promise<T> {
  const url = new URL(`${CG_BASE_URL}${path}`)

  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v))
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  // Use header auth (preferred method per docs)
  if (API_KEY) {
    headers['x-cg-demo-api-key'] = API_KEY
  }

  const res = await fetch(url.toString(), { headers })

  if (!res.ok) {
    let cgCode: number | null = null
    try {
      const body = await res.json() as { status?: { error_code?: number } }
      cgCode = body?.status?.error_code ?? null
    } catch { /* ignore */ }

    throw new CoinGeckoError(
      res.status,
      cgCode,
      `CoinGecko ${res.status}${cgCode ? ` (code ${cgCode})` : ''}: ${path}`,
    )
  }

  return res.json() as Promise<T>
}
