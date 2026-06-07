/**
 * CoinGecko Backend Service — Demo Plan
 * Covers all 13 endpoint groups with Redis caching.
 * Rate limit: 30 calls/min — TTLs are set to prevent breaching this.
 *
 * Auto-granularity note (leave `interval` unset unless overriding):
 *   market_chart: 1d → 5-minutely, 2–90d → hourly, >90d → daily
 *   ohlc:         1–2d → 30min, 3–30d → 4h, ≥31d → 4-day
 *   global/market_cap_chart: 1d → hourly, ≥2d → daily
 *
 * Date formats:
 *   market_chart/range, ohlc/range, supply range → ISO YYYY-MM-DD (or UNIX seconds)
 *   coins/{id}/history                           → DD-MM-YYYY
 *   exchanges volume_chart/range                 → UNIX seconds
 *   All chart response timestamps                → UNIX milliseconds
 */

import { cgFetch } from '../config/coingecko.client'
import { redis }   from '../config/redis'
import type {
  SimplePriceResponse, SimpleTokenPriceResponse, SupportedVsCurrencies,
  CoinListItem, NewCoin, CoinMarket, TopGainersLosersResponse,
  CoinDetail, CoinTickersResponse, CoinHistoryResponse,
  MarketChartResponse, OHLCResponse,
  CirculatingSupplyChartResponse, TotalSupplyChartResponse,
  AssetPlatform, TokenList,
  CategoryListItem, CategoryMarket,
  ExchangeListItem, Exchange, ExchangeTickersResponse, ExchangeVolumeChart,
  DerivativeTicker, DerivativesExchangeListItem, DerivativesExchange,
  NFTListItem, NFTCollection, NFTTickersResponse, NFTMarketChartResponse,
  ExchangeRatesResponse,
  SearchResponse, TrendingResponse,
  GlobalResponse, GlobalDeFiResponse, GlobalMarketCapChartResponse,
  EntityListItem, PublicTreasuryResponse, EntityDetail,
  EntityHoldingChartResponse, EntityTransactionHistoryResponse,
} from '../models/coingecko.model'

// ─── Cache helper ─────────────────────────────────────────────────────────────
async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = await redis.get(key)
  if (hit) return JSON.parse(hit) as T
  const data = await fn()
  await redis.set(key, JSON.stringify(data), { EX: ttl })
  return data
}

/** TTLs in seconds — balanced against 30 req/min rate limit */
const TTL = {
  PRICE:       30,    // live prices — min granularity CoinGecko caches
  MARKETS:     60,    // coin market table
  CHART:       300,   // historical charts — 5 min
  DETAIL:      300,   // coin metadata
  TICKERS:     60,    // exchange/coin tickers
  TRENDING:    300,   // trending
  GLOBAL:      120,   // global stats
  STATIC:      3600,  // lists that rarely change (coin list, categories, platforms)
  EXCHANGE:    120,   // exchange data
  DERIVATIVES: 120,
  NFT:         120,
  TREASURY:    300,
}

// ─────────────────────────────────────────────────────────────────────────────
export class CoinGeckoService {

  // ═══════════════════════════════════════════════════════════════════════════
  // 0. Ping
  // ═══════════════════════════════════════════════════════════════════════════

  ping() {
    return cgFetch<{ gecko_says: string }>('/ping')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Simple
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /simple/price
   * ids: CoinGecko coin IDs e.g. ['bitcoin','ethereum']
   * vsCurrencies: e.g. ['usd','btc']
   * precision: 'full' | 0–18
   */
  getSimplePrices(
    ids: string[],
    vsCurrencies: string[] = ['usd'],
    opts: {
      includeMarketCap?:   boolean
      include24hVol?:      boolean
      include24hChange?:   boolean
      includeLastUpdated?: boolean
      precision?:          string | number
    } = {},
  ): Promise<SimplePriceResponse> {
    const key = `cg:price:${ids.sort().join(',')}:${vsCurrencies.join(',')}`
    return cached(key, TTL.PRICE, () =>
      cgFetch<SimplePriceResponse>('/simple/price', {
        ids:                    ids.join(','),
        vs_currencies:          vsCurrencies.join(','),
        include_market_cap:     String(opts.includeMarketCap   ?? true),
        include_24hr_vol:       String(opts.include24hVol      ?? true),
        include_24hr_change:    String(opts.include24hChange   ?? true),
        include_last_updated_at: String(opts.includeLastUpdated ?? true),
        ...(opts.precision !== undefined ? { precision: String(opts.precision) } : {}),
      }),
    )
  }

  /**
   * GET /simple/token_price/{id}
   * platformId: asset platform e.g. 'ethereum', 'solana'
   */
  getTokenPrices(
    platformId: string,
    contractAddresses: string[],
    vsCurrencies: string[] = ['usd'],
    precision?: string | number,
  ): Promise<SimpleTokenPriceResponse> {
    const key = `cg:tokenprice:${platformId}:${contractAddresses.join(',')}`
    return cached(key, TTL.PRICE, () =>
      cgFetch<SimpleTokenPriceResponse>(`/simple/token_price/${platformId}`, {
        contract_addresses: contractAddresses.join(','),
        vs_currencies:      vsCurrencies.join(','),
        include_24hr_change: 'true',
        include_market_cap:  'true',
        ...(precision !== undefined ? { precision: String(precision) } : {}),
      }),
    )
  }

  /** GET /simple/supported_vs_currencies */
  getSupportedCurrencies(): Promise<SupportedVsCurrencies> {
    return cached('cg:vs_currencies', TTL.STATIC, () =>
      cgFetch<SupportedVsCurrencies>('/simple/supported_vs_currencies'),
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Coins
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /coins/list — full ID map (id, symbol, name, platforms) */
  getCoinList(includePlatforms = false): Promise<CoinListItem[]> {
    return cached(`cg:coins:list:${includePlatforms}`, TTL.STATIC, () =>
      cgFetch<CoinListItem[]>('/coins/list', {
        include_platform: String(includePlatforms),
        status: 'active',
      }),
    )
  }

  /** GET /coins/list/new — recently listed coins */
  getNewCoins(): Promise<NewCoin[]> {
    return cached('cg:coins:new', 300, () =>
      cgFetch<NewCoin[]>('/coins/list/new'),
    )
  }

  /**
   * GET /coins/markets — paginated coin market data
   * per_page: 1–250
   * priceChangePercentage: '1h,24h,7d,14d,30d,200d,1y'
   */
  getCoinsMarkets(opts: {
    vsCurrency?:             string
    ids?:                    string[]
    category?:               string
    order?:                  'market_cap_desc' | 'market_cap_asc' | 'volume_desc' | 'volume_asc' | 'id_asc' | 'id_desc'
    perPage?:                number
    page?:                   number
    sparkline?:              boolean
    priceChangePercentage?:  string
    precision?:              string | number
  } = {}): Promise<CoinMarket[]> {
    const {
      vsCurrency = 'usd', ids, category,
      order = 'market_cap_desc', perPage = 100, page = 1,
      sparkline = false, priceChangePercentage = '1h,24h,7d', precision,
    } = opts

    const key = `cg:markets:${vsCurrency}:${ids?.join(',') ?? 'all'}:${category ?? ''}:${order}:${perPage}:${page}`
    return cached(key, TTL.MARKETS, () =>
      cgFetch<CoinMarket[]>('/coins/markets', {
        vs_currency:              vsCurrency,
        order,
        per_page:                 perPage,
        page,
        sparkline:                String(sparkline),
        price_change_percentage:  priceChangePercentage,
        ...(ids?.length  ? { ids: ids.join(',') } : {}),
        ...(category     ? { category }            : {}),
        ...(precision !== undefined ? { precision: String(precision) } : {}),
      }),
    )
  }

  /**
   * GET /coins/top_gainers_losers
   * duration: '1h' | '24h' | '7d' | '14d' | '30d' | '60d' | '1y'
   * topCoins: '300' | '500' | '1000' | 'all'
   */
  getTopGainersLosers(
    vsCurrency = 'usd',
    duration: '1h' | '24h' | '7d' | '14d' | '30d' | '60d' | '1y' = '24h',
    topCoins: '300' | '500' | '1000' | 'all' = '1000',
  ): Promise<TopGainersLosersResponse> {
    const key = `cg:gainers_losers:${vsCurrency}:${duration}:${topCoins}`
    return cached(key, TTL.MARKETS, () =>
      cgFetch<TopGainersLosersResponse>('/coins/top_gainers_losers', {
        vs_currency: vsCurrency,
        duration,
        top_coins:   topCoins,
      }),
    )
  }

  /**
   * GET /coins/{id} — full coin metadata
   * Includes market_data, community_data, developer_data, links, image
   */
  getCoinDetail(
    coinId: string,
    opts: {
      localization?:   boolean
      tickers?:        boolean
      marketData?:     boolean
      communityData?:  boolean
      developerData?:  boolean
      sparkline?:      boolean
    } = {},
  ): Promise<CoinDetail> {
    return cached(`cg:detail:${coinId}`, TTL.DETAIL, () =>
      cgFetch<CoinDetail>(`/coins/${coinId}`, {
        localization:    String(opts.localization   ?? false),
        tickers:         String(opts.tickers        ?? false),
        market_data:     String(opts.marketData     ?? true),
        community_data:  String(opts.communityData  ?? true),
        developer_data:  String(opts.developerData  ?? false),
        sparkline:       String(opts.sparkline      ?? false),
      }),
    )
  }

  /**
   * GET /coins/{id}/tickers
   * paginated 100/page, ordered by trust_score_desc by default
   */
  getCoinTickers(coinId: string, page = 1): Promise<CoinTickersResponse> {
    return cached(`cg:tickers:${coinId}:${page}`, TTL.TICKERS, () =>
      cgFetch<CoinTickersResponse>(`/coins/${coinId}/tickers`, {
        page,
        include_exchange_logo: 'false',
        order:                 'trust_score_desc',
        depth:                 'false',
      }),
    )
  }

  /**
   * GET /coins/{id}/history
   * date format: DD-MM-YYYY
   */
  getCoinHistory(coinId: string, date: string): Promise<CoinHistoryResponse> {
    return cached(`cg:history:${coinId}:${date}`, TTL.CHART, () =>
      cgFetch<CoinHistoryResponse>(`/coins/${coinId}/history`, {
        date,
        localization: 'false',
      }),
    )
  }

  /**
   * GET /coins/{id}/market_chart
   * days: 1 | 7 | 14 | 30 | 90 | 180 | 365 | 'max'
   * Leave interval unset for auto-granularity (recommended)
   * Demo plan: hourly data available up to past 100 days
   */
  getMarketChart(
    coinId: string,
    vsCurrency = 'usd',
    days: number | 'max' = 7,
    interval?: 'daily' | 'hourly',
    precision?: string | number,
  ): Promise<MarketChartResponse> {
    const key = `cg:chart:${coinId}:${vsCurrency}:${days}:${interval ?? 'auto'}`
    return cached(key, TTL.CHART, () =>
      cgFetch<MarketChartResponse>(`/coins/${coinId}/market_chart`, {
        vs_currency: vsCurrency,
        days:        String(days),
        ...(interval  ? { interval }                          : {}),
        ...(precision !== undefined ? { precision: String(precision) } : {}),
      }),
    )
  }

  /**
   * GET /coins/{id}/market_chart/range
   * from/to: ISO date YYYY-MM-DD or UNIX seconds
   */
  getMarketChartRange(
    coinId: string,
    from: string | number,
    to: string | number,
    vsCurrency = 'usd',
    precision?: string | number,
  ): Promise<MarketChartResponse> {
    const key = `cg:chartrange:${coinId}:${vsCurrency}:${from}:${to}`
    return cached(key, TTL.CHART, () =>
      cgFetch<MarketChartResponse>(`/coins/${coinId}/market_chart/range`, {
        vs_currency: vsCurrency,
        from:        String(from),
        to:          String(to),
        ...(precision !== undefined ? { precision: String(precision) } : {}),
      }),
    )
  }

  /**
   * GET /coins/{id}/ohlc
   * days: 1 | 7 | 14 | 30 | 90 | 180 | 365 | 'max'
   * Auto candles: 1–2d→30min, 3–30d→4h, ≥31d→4day
   */
  getOHLC(
    coinId: string,
    vsCurrency = 'usd',
    days: 1 | 7 | 14 | 30 | 90 | 180 | 365 | 'max' = 7,
    interval?: 'daily' | 'hourly',
  ): Promise<OHLCResponse> {
    const key = `cg:ohlc:${coinId}:${vsCurrency}:${days}:${interval ?? 'auto'}`
    return cached(key, TTL.CHART, () =>
      cgFetch<OHLCResponse>(`/coins/${coinId}/ohlc`, {
        vs_currency: vsCurrency,
        days:        String(days),
        ...(interval ? { interval } : {}),
      }),
    )
  }

  /**
   * GET /coins/{id}/ohlc/range
   * from/to: ISO date YYYY-MM-DD
   * interval: 'daily' (max 180d) | 'hourly' (max 31d)
   * Data available from 9 Feb 2018 onwards.
   */
  getOHLCRange(
    coinId: string,
    from: string,
    to: string,
    interval: 'daily' | 'hourly',
    vsCurrency = 'usd',
  ): Promise<OHLCResponse> {
    const key = `cg:ohlcrange:${coinId}:${vsCurrency}:${from}:${to}:${interval}`
    return cached(key, TTL.CHART, () =>
      cgFetch<OHLCResponse>(`/coins/${coinId}/ohlc/range`, {
        vs_currency: vsCurrency,
        from,
        to,
        interval,
      }),
    )
  }

  /** GET /coins/{id}/circulating_supply_chart */
  getCirculatingSupplyChart(coinId: string, days: number | 'max' = 30): Promise<CirculatingSupplyChartResponse> {
    const key = `cg:circ_supply:${coinId}:${days}`
    return cached(key, TTL.CHART, () =>
      cgFetch<CirculatingSupplyChartResponse>(`/coins/${coinId}/circulating_supply_chart`, {
        days: String(days),
      }),
    )
  }

  /** GET /coins/{id}/circulating_supply_chart/range */
  getCirculatingSupplyChartRange(coinId: string, from: string, to: string): Promise<CirculatingSupplyChartResponse> {
    const key = `cg:circ_supply_range:${coinId}:${from}:${to}`
    return cached(key, TTL.CHART, () =>
      cgFetch<CirculatingSupplyChartResponse>(`/coins/${coinId}/circulating_supply_chart/range`, { from, to }),
    )
  }

  /** GET /coins/{id}/total_supply_chart — daily only */
  getTotalSupplyChart(coinId: string, days: number | 'max' = 30): Promise<TotalSupplyChartResponse> {
    const key = `cg:total_supply:${coinId}:${days}`
    return cached(key, TTL.CHART, () =>
      cgFetch<TotalSupplyChartResponse>(`/coins/${coinId}/total_supply_chart`, {
        days: String(days),
      }),
    )
  }

  /** GET /coins/{id}/total_supply_chart/range */
  getTotalSupplyChartRange(coinId: string, from: string, to: string): Promise<TotalSupplyChartResponse> {
    const key = `cg:total_supply_range:${coinId}:${from}:${to}`
    return cached(key, TTL.CHART, () =>
      cgFetch<TotalSupplyChartResponse>(`/coins/${coinId}/total_supply_chart/range`, { from, to }),
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Contract
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /coins/{platformId}/contract/{contractAddress} */
  getContractDetail(platformId: string, contractAddress: string): Promise<CoinDetail> {
    const key = `cg:contract:${platformId}:${contractAddress}`
    return cached(key, TTL.DETAIL, () =>
      cgFetch<CoinDetail>(`/coins/${platformId}/contract/${contractAddress}`),
    )
  }

  /** GET /coins/{platformId}/contract/{contractAddress}/market_chart */
  getContractChart(
    platformId: string,
    contractAddress: string,
    vsCurrency = 'usd',
    days: number | 'max' = 7,
  ): Promise<MarketChartResponse> {
    const key = `cg:contractchart:${platformId}:${contractAddress}:${days}`
    return cached(key, TTL.CHART, () =>
      cgFetch<MarketChartResponse>(`/coins/${platformId}/contract/${contractAddress}/market_chart`, {
        vs_currency: vsCurrency,
        days:        String(days),
      }),
    )
  }

  /** GET /coins/{platformId}/contract/{contractAddress}/market_chart/range */
  getContractChartRange(
    platformId: string,
    contractAddress: string,
    from: string | number,
    to: string | number,
    vsCurrency = 'usd',
  ): Promise<MarketChartResponse> {
    const key = `cg:contractchart_range:${platformId}:${contractAddress}:${from}:${to}`
    return cached(key, TTL.CHART, () =>
      cgFetch<MarketChartResponse>(`/coins/${platformId}/contract/${contractAddress}/market_chart/range`, {
        vs_currency: vsCurrency,
        from: String(from),
        to:   String(to),
      }),
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Asset Platforms
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /asset_platforms — filter: 'nft' for NFT-supported chains only */
  getAssetPlatforms(filter?: 'nft'): Promise<AssetPlatform[]> {
    const key = `cg:asset_platforms:${filter ?? 'all'}`
    return cached(key, TTL.STATIC, () =>
      cgFetch<AssetPlatform[]>('/asset_platforms', filter ? { filter } : {}),
    )
  }

  /** GET /token_lists/{asset_platform_id}/all.json */
  getTokenList(assetPlatformId: string): Promise<TokenList> {
    const key = `cg:tokenlist:${assetPlatformId}`
    return cached(key, TTL.STATIC, () =>
      cgFetch<TokenList>(`/token_lists/${assetPlatformId}/all.json`),
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Categories
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /coins/categories/list */
  getCategoryList(): Promise<CategoryListItem[]> {
    return cached('cg:categories:list', TTL.STATIC, () =>
      cgFetch<CategoryListItem[]>('/coins/categories/list'),
    )
  }

  /**
   * GET /coins/categories
   * order: 'market_cap_desc' | 'market_cap_asc' | 'name_desc' | 'name_asc'
   *        | 'market_cap_change_24h_desc' | 'market_cap_change_24h_asc'
   */
  getCategories(order = 'market_cap_desc'): Promise<CategoryMarket[]> {
    return cached(`cg:categories:${order}`, TTL.MARKETS, () =>
      cgFetch<CategoryMarket[]>('/coins/categories', { order }),
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Exchanges
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /exchanges/list */
  getExchangeList(): Promise<ExchangeListItem[]> {
    return cached('cg:exchanges:list', TTL.STATIC, () =>
      cgFetch<ExchangeListItem[]>('/exchanges/list', { status: 'active' }),
    )
  }

  /** GET /exchanges — paginated with trust score, volume data */
  getExchanges(perPage = 100, page = 1): Promise<Exchange[]> {
    const key = `cg:exchanges:${perPage}:${page}`
    return cached(key, TTL.EXCHANGE, () =>
      cgFetch<Exchange[]>('/exchanges', { per_page: perPage, page }),
    )
  }

  /** GET /exchanges/{id} — single exchange + top 100 tickers */
  getExchange(exchangeId: string): Promise<Exchange> {
    return cached(`cg:exchange:${exchangeId}`, TTL.EXCHANGE, () =>
      cgFetch<Exchange>(`/exchanges/${exchangeId}`),
    )
  }

  /** GET /exchanges/{id}/tickers — paginated */
  getExchangeTickers(exchangeId: string, coinIds?: string[], page = 1): Promise<ExchangeTickersResponse> {
    const key = `cg:exchange_tickers:${exchangeId}:${coinIds?.join(',') ?? 'all'}:${page}`
    return cached(key, TTL.TICKERS, () =>
      cgFetch<ExchangeTickersResponse>(`/exchanges/${exchangeId}/tickers`, {
        page,
        include_exchange_logo: 'false',
        order: 'trust_score_desc',
        depth: 'false',
        ...(coinIds?.length ? { coin_ids: coinIds.join(',') } : {}),
      }),
    )
  }

  /**
   * GET /exchanges/{id}/volume_chart
   * days: 1 | 7 | 14 | 30 | 90 | 180 | 365
   * Returns [ms_timestamp, volume_in_btc_string][]
   */
  getExchangeVolumeChart(exchangeId: string, days: 1 | 7 | 14 | 30 | 90 | 180 | 365 = 7): Promise<ExchangeVolumeChart> {
    const key = `cg:exchange_vol:${exchangeId}:${days}`
    return cached(key, TTL.CHART, () =>
      cgFetch<ExchangeVolumeChart>(`/exchanges/${exchangeId}/volume_chart`, { days }),
    )
  }

  /**
   * GET /exchanges/{id}/volume_chart/range
   * from/to: UNIX seconds — max 31-day range
   */
  getExchangeVolumeChartRange(exchangeId: string, from: number, to: number): Promise<ExchangeVolumeChart> {
    const key = `cg:exchange_vol_range:${exchangeId}:${from}:${to}`
    return cached(key, TTL.CHART, () =>
      cgFetch<ExchangeVolumeChart>(`/exchanges/${exchangeId}/volume_chart/range`, { from, to }),
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. Derivatives
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /derivatives — all derivative tickers */
  getDerivatives(): Promise<DerivativeTicker[]> {
    return cached('cg:derivatives', TTL.DERIVATIVES, () =>
      cgFetch<DerivativeTicker[]>('/derivatives'),
    )
  }

  /** GET /derivatives/exchanges/list */
  getDerivativesExchangeList(): Promise<DerivativesExchangeListItem[]> {
    return cached('cg:derivatives:exchanges:list', TTL.STATIC, () =>
      cgFetch<DerivativesExchangeListItem[]>('/derivatives/exchanges/list'),
    )
  }

  /** GET /derivatives/exchanges — paginated */
  getDerivativesExchanges(
    order = 'open_interest_btc_desc',
    perPage = 100,
    page = 1,
  ): Promise<DerivativesExchange[]> {
    const key = `cg:derivatives:exchanges:${order}:${perPage}:${page}`
    return cached(key, TTL.DERIVATIVES, () =>
      cgFetch<DerivativesExchange[]>('/derivatives/exchanges', { order, per_page: perPage, page }),
    )
  }

  /**
   * GET /derivatives/exchanges/{id}
   * includeTickers: 'all' | 'unexpired' — omit to exclude tickers
   */
  getDerivativesExchange(exchangeId: string, includeTickers?: 'all' | 'unexpired'): Promise<DerivativesExchange> {
    const key = `cg:derivatives:exchange:${exchangeId}:${includeTickers ?? 'none'}`
    return cached(key, TTL.DERIVATIVES, () =>
      cgFetch<DerivativesExchange>(`/derivatives/exchanges/${exchangeId}`, {
        ...(includeTickers ? { include_tickers: includeTickers } : {}),
      }),
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. NFTs (Beta)
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /nfts/list */
  getNFTList(order = 'market_cap_usd_desc', perPage = 100, page = 1): Promise<NFTListItem[]> {
    const key = `cg:nfts:list:${order}:${perPage}:${page}`
    return cached(key, TTL.NFT, () =>
      cgFetch<NFTListItem[]>('/nfts/list', { order, per_page: perPage, page }),
    )
  }

  /** GET /nfts/markets — NFT collections with market data */
  getNFTMarkets(
    assetPlatformId?: string,
    order = 'market_cap_usd_desc',
    perPage = 100,
    page = 1,
  ): Promise<NFTCollection[]> {
    const key = `cg:nfts:markets:${assetPlatformId ?? 'all'}:${order}:${perPage}:${page}`
    return cached(key, TTL.NFT, () =>
      cgFetch<NFTCollection[]>('/nfts/markets', {
        order,
        per_page: perPage,
        page,
        ...(assetPlatformId ? { asset_platform_id: assetPlatformId } : {}),
      }),
    )
  }

  /** GET /nfts/{id} */
  getNFT(nftId: string): Promise<NFTCollection> {
    return cached(`cg:nft:${nftId}`, TTL.NFT, () =>
      cgFetch<NFTCollection>(`/nfts/${nftId}`),
    )
  }

  /** GET /nfts/{asset_platform_id}/contract/{contract_address} */
  getNFTByContract(platformId: string, contractAddress: string): Promise<NFTCollection> {
    const key = `cg:nft:contract:${platformId}:${contractAddress}`
    return cached(key, TTL.NFT, () =>
      cgFetch<NFTCollection>(`/nfts/${platformId}/contract/${contractAddress}`),
    )
  }

  /** GET /nfts/{id}/tickers — per-marketplace floor & volume */
  getNFTTickers(nftId: string): Promise<NFTTickersResponse> {
    return cached(`cg:nft:tickers:${nftId}`, TTL.NFT, () =>
      cgFetch<NFTTickersResponse>(`/nfts/${nftId}/tickers`),
    )
  }

  /**
   * GET /nfts/{id}/market_chart
   * Auto granularity: 1–14d → 5-minutely, ≥15d → daily
   */
  getNFTMarketChart(nftId: string, days: number | 'max' = 30): Promise<NFTMarketChartResponse> {
    const key = `cg:nft:chart:${nftId}:${days}`
    return cached(key, TTL.CHART, () =>
      cgFetch<NFTMarketChartResponse>(`/nfts/${nftId}/market_chart`, { days: String(days) }),
    )
  }

  /** GET /nfts/{asset_platform_id}/contract/{contract_address}/market_chart */
  getNFTMarketChartByContract(
    platformId: string,
    contractAddress: string,
    days: number | 'max' = 30,
  ): Promise<NFTMarketChartResponse> {
    const key = `cg:nft:chart:contract:${platformId}:${contractAddress}:${days}`
    return cached(key, TTL.CHART, () =>
      cgFetch<NFTMarketChartResponse>(
        `/nfts/${platformId}/contract/${contractAddress}/market_chart`,
        { days: String(days) },
      ),
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. Exchange Rates
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /exchange_rates — BTC rates against 30+ currencies */
  getExchangeRates(): Promise<ExchangeRatesResponse> {
    return cached('cg:exchange_rates', TTL.GLOBAL, () =>
      cgFetch<ExchangeRatesResponse>('/exchange_rates'),
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. Search
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /search — coins, exchanges, categories, nfts */
  search(query: string): Promise<SearchResponse> {
    // Not cached — queries are unique
    return cgFetch<SearchResponse>('/search', { query })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. Trending
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /search/trending — top 7 coins, 3 NFTs, 6 categories (24h) */
  getTrending(): Promise<TrendingResponse> {
    return cached('cg:trending', TTL.TRENDING, () =>
      cgFetch<TrendingResponse>('/search/trending'),
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. Global
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /global — total market cap, volume, BTC dominance */
  getGlobal(): Promise<GlobalResponse> {
    return cached('cg:global', TTL.GLOBAL, () =>
      cgFetch<GlobalResponse>('/global'),
    )
  }

  /** GET /global/decentralized_finance_defi — DeFi market data */
  getGlobalDeFi(): Promise<GlobalDeFiResponse> {
    return cached('cg:global:defi', TTL.GLOBAL, () =>
      cgFetch<GlobalDeFiResponse>('/global/decentralized_finance_defi'),
    )
  }

  /**
   * GET /global/market_cap_chart
   * days: 1 | 7 | 14 | 30 | 90 | 180 | 365 | 'max'
   * Auto granularity: 1d → hourly, ≥2d → daily
   */
  getGlobalMarketCapChart(
    days: number | 'max' = 30,
    vsCurrency = 'usd',
  ): Promise<GlobalMarketCapChartResponse> {
    const key = `cg:global:mktcap_chart:${days}:${vsCurrency}`
    return cached(key, TTL.CHART, () =>
      cgFetch<GlobalMarketCapChartResponse>('/global/market_cap_chart', {
        days:        String(days),
        vs_currency: vsCurrency,
      }),
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. Companies / Public Treasury (Beta)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /entities/list
   * entityType: 'company' | 'government'
   */
  getEntityList(entityType: 'company' | 'government' = 'company', perPage = 100, page = 1): Promise<EntityListItem[]> {
    const key = `cg:entities:${entityType}:${perPage}:${page}`
    return cached(key, TTL.TREASURY, () =>
      cgFetch<EntityListItem[]>('/entities/list', { entity_type: entityType, per_page: perPage, page }),
    )
  }

  /**
   * GET /companies/public_treasury/{coin_id}  (or /governments/...)
   * entity: 'companies' | 'governments'
   * coinId: 'bitcoin' | 'ethereum'
   */
  getPublicTreasury(
    coinId: 'bitcoin' | 'ethereum',
    entity: 'companies' | 'governments' = 'companies',
    order = 'total_holdings_usd_desc',
  ): Promise<PublicTreasuryResponse> {
    const key = `cg:treasury:${entity}:${coinId}`
    return cached(key, TTL.TREASURY, () =>
      cgFetch<PublicTreasuryResponse>(`/${entity}/public_treasury/${coinId}`, {
        per_page: 250,
        page:     1,
        order,
      }),
    )
  }

  /**
   * GET /public_treasury/{entity_id}
   * holdingChange: '7d,30d,1y'
   */
  getEntityDetail(entityId: string, holdingChange = '7d,30d,1y'): Promise<EntityDetail> {
    const key = `cg:entity:${entityId}`
    return cached(key, TTL.TREASURY, () =>
      cgFetch<EntityDetail>(`/public_treasury/${entityId}`, {
        holding_amount_change:     holdingChange,
        holding_change_percentage: holdingChange,
      }),
    )
  }

  /**
   * GET /public_treasury/{entity_id}/{coin_id}/holding_chart
   * days: 7 | 14 | 30 | 90 | 180 | 365 | 730 | 'max'
   * Data available from Aug 2020.
   */
  getEntityHoldingChart(
    entityId: string,
    coinId: string,
    days: 7 | 14 | 30 | 90 | 180 | 365 | 730 | 'max' = 365,
  ): Promise<EntityHoldingChartResponse> {
    const key = `cg:entity:holding_chart:${entityId}:${coinId}:${days}`
    return cached(key, TTL.TREASURY, () =>
      cgFetch<EntityHoldingChartResponse>(`/public_treasury/${entityId}/${coinId}/holding_chart`, {
        days:                    String(days),
        include_empty_intervals: 'false',
      }),
    )
  }

  /**
   * GET /public_treasury/{entity_id}/transaction_history
   * order: 'date_desc' | 'date_asc'
   */
  getEntityTransactionHistory(
    entityId: string,
    coinIds?: string[],
    page = 1,
    order = 'date_desc',
  ): Promise<EntityTransactionHistoryResponse> {
    const key = `cg:entity:txns:${entityId}:${coinIds?.join(',') ?? 'all'}:${page}`
    return cached(key, TTL.TREASURY, () =>
      cgFetch<EntityTransactionHistoryResponse>(`/public_treasury/${entityId}/transaction_history`, {
        per_page: 100,
        page,
        order,
        ...(coinIds?.length ? { coin_ids: coinIds.join(',') } : {}),
      }),
    )
  }
}
