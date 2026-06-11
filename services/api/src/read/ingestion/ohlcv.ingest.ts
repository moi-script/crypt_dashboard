
// ============================================================
// ohlcv.ingest.ts
// Fetches multi-timeframe OHLCV data from Binance REST API
// with Redis caching (configurable TTL per timeframe)
// ============================================================

import { createClient } from 'redis';
import { Candle } from '../../agents/chartAnalysis.types';

// ─── Types ───────────────────────────────────────────────────
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export interface OHLCVRequest {
    symbol: string;       // e.g. 'BTCUSDT'
    timeframe: Timeframe;
    limit?: number;       // default 200
    forceRefresh?: boolean;
}

export interface OHLCVResult {
    symbol: string;
    timeframe: Timeframe;
    candles: Candle[];
    cached: boolean;
    fetched_at: string;
}

// ─── TTL config per timeframe (seconds) ──────────────────────
const TTL_BY_TIMEFRAME: Record<Timeframe, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '4h': 14400,
    '1d': 86400,
    '1w': 604800,
};

// ─── Binance kline interval map ──────────────────────────────
const BINANCE_INTERVAL: Record<Timeframe, string> = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '1h': '1h',
    '4h': '4h',
    '1d': '1d',
    '1w': '1w',
};

// ─── Parse raw Binance kline array ───────────────────────────
function parseBinanceKline(raw: any[]): Candle {
    return {
        timestamp: raw[0] as number,
        open: parseFloat(raw[1]),
        high: parseFloat(raw[2]),
        low: parseFloat(raw[3]),
        close: parseFloat(raw[4]),
        volume: parseFloat(raw[5]),
    };
}

// ─── Redis cache key ─────────────────────────────────────────
function cacheKey(symbol: string, timeframe: Timeframe): string {
    return `ohlcv:${symbol}:${timeframe}`;
}

// ─── Main Fetcher ────────────────────────────────────────────
export class OHLCVIngest {
    private redisClient: any;
    private baseUrl: string;
    private apiKey: string;

    constructor() {
        this.baseUrl = process.env.BINANCE_BASE_URL || 'https://api.binance.com';
        this.apiKey = process.env.BINANCE_API_KEY || '';
    }

    async init(): Promise<void> {
        this.redisClient = createClient({ url: process.env.REDIS_URL });
        await this.redisClient.connect();
    }

    // ─── Fetch single timeframe ────────────────────────────────
    async fetch(req: OHLCVRequest): Promise<OHLCVResult> {
        const { symbol, timeframe, limit = 200, forceRefresh = false } = req;
        const key = cacheKey(symbol, timeframe);

        // 1. Try cache first (unless forced refresh)
        if (!forceRefresh && this.redisClient) {
            try {
                const cached = await this.redisClient.get(key);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    return { ...parsed, cached: true };
                }
            } catch (_) {
                // Redis miss or error — fall through to API
            }
        }

        // 2. Fetch from Binance
        const url = `${this.baseUrl}/api/v3/klines?symbol=${symbol}&interval=${BINANCE_INTERVAL[timeframe]}&limit=${limit}`;
        const headers: Record<string, string> = {};
        if (this.apiKey) headers['X-MBX-APIKEY'] = this.apiKey;

        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`Binance OHLCV fetch failed: ${response.status} ${response.statusText} for ${symbol} ${timeframe}`);
        }

        const raw: any[][] = await response.json() as any[][];;
        const candles: Candle[] = raw.map(parseBinanceKline);

        const result: OHLCVResult = {
            symbol,
            timeframe,
            candles,
            cached: false,
            fetched_at: new Date().toISOString(),
        };

        // 3. Cache result
        if (this.redisClient) {
            const ttl = parseInt(process.env.CHART_ANALYSIS_CACHE_TTL || '0') || TTL_BY_TIMEFRAME[timeframe];
            try {
                await this.redisClient.set(key, JSON.stringify(result), { EX: ttl });
            } catch (_) {
                // Cache write failure is non-fatal
            }
        }

        return result;
    }

    // ─── Fetch multiple timeframes in parallel ─────────────────
    async fetchMultiTimeframe(
        symbol: string,
        timeframes: Timeframe[],
        limit = 200
    ): Promise<Record<Timeframe, Candle[]>> {
        const results = await Promise.all(
            timeframes.map(tf => this.fetch({ symbol, timeframe: tf, limit }))
        );

        const map: Partial<Record<Timeframe, Candle[]>> = {};
        for (const r of results) {
            map[r.timeframe] = r.candles;
        }
        return map as Record<Timeframe, Candle[]>;
    }

    // ─── Fetch order book depth ───────────────────────────────
    async fetchOrderBook(symbol: string, limit = 100): Promise<{ bids: number[][]; asks: number[][] }> {
        const url = `${this.baseUrl}/api/v3/depth?symbol=${symbol}&limit=${limit}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Order book fetch failed: ${response.status}`);
        return response.json() as Promise<{ bids: number[][]; asks: number[][] }>;

    }

    // ─── Fetch funding rate (futures) ─────────────────────────
    async fetchFundingRate(symbol: string): Promise<{ fundingRate: number; fundingTime: number } | null> {
        try {
            const url = `${this.baseUrl}/fapi/v1/fundingRate?symbol=${symbol}&limit=1`;
            const response = await fetch(url);
            if (!response.ok) return null;
            const data = await response.json() as any[];
            return data[0] ? { fundingRate: parseFloat(data[0].fundingRate), fundingTime: data[0].fundingTime } : null;

        } catch (_) {
            return null;
        }
    }

    // ─── Fetch open interest ──────────────────────────────────
    async fetchOpenInterest(symbol: string): Promise<{ openInterest: number } | null> {
        try {
            const url = `${this.baseUrl}/fapi/v1/openInterest?symbol=${symbol}`;
            const response = await fetch(url);
            if (!response.ok) return null;
            const data = await response.json() as { openInterest: string };
            return { openInterest: parseFloat(data.openInterest) };
        } catch (_) {
            return null;
        }
    }

    async disconnect(): Promise<void> {
        if (this.redisClient) await this.redisClient.disconnect();
    }
}

// ─── Singleton export ─────────────────────────────────────────
export const ohlcvIngest = new OHLCVIngest();

