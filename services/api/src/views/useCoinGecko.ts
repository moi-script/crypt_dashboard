// /**
//  * CoinGecko React Query Hooks
//  * One hook per service method. All call your own backend (/api/*),
//  * which proxies to CoinGecko with Redis caching.
//  *
//  * staleTime mirrors backend TTL so the browser doesn't over-fetch.
//  * refetchInterval is set for live data; omitted for static/historic data.
//  *
//  * Place <CoinGeckoAttribution /> near any component using these hooks.
//  */

// import { useQuery } from '@tanstack/react-query'
// import type {
//   SimplePriceResponse, SimpleTokenPriceResponse,
//   CoinListItem, NewCoin, CoinMarket, TopGainersLosersResponse,
//   CoinDetail, CoinTickersResponse, CoinHistoryResponse,
//   MarketChartResponse, OHLCResponse,
//   CirculatingSupplyChartResponse, TotalSupplyChartResponse,
//   AssetPlatform, TokenList,
//   CategoryListItem, CategoryMarket,
//   Exchange, ExchangeListItem, ExchangeTickersResponse, ExchangeVolumeChart,
//   DerivativeTicker, DerivativesExchange, DerivativesExchangeListItem,
//   NFTListItem, NFTCollection, NFTTickersResponse, NFTMarketChartResponse,
//   ExchangeRatesResponse,
//   SearchResponse, TrendingResponse,
//   GlobalResponse, GlobalDeFiResponse, GlobalMarketCapChartResponse,
//   EntityListItem, PublicTreasuryResponse, EntityDetail,
//   EntityHoldingChartResponse, EntityTransactionHistoryResponse,
// } from '@/models/coingecko.model'
// // ─── Base fetcher ─────────────────────────────────────────────────────────────
// async function api<T>(path: string): Promise<T> {
//   const res = await fetch(`/api${path}`)
//   if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
//   return res.json() as Promise<T>
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // 1. Simple / Prices
// // ─────────────────────────────────────────────────────────────────────────────

// export function useSimplePrices(ids: string[], vsCurrency = 'usd') {
//   return useQuery<SimplePriceResponse>({
//     queryKey:        ['cg', 'price', [...ids].sort(), vsCurrency],
//     queryFn:         () => api(`/simple/price?ids=${ids.join(',')}&vs=${vsCurrency}`),
//     staleTime:       30_000,
//     refetchInterval: 30_000,
//     enabled:         ids.length > 0,
//   })
// }

// export function useTokenPrices(platform: string, contracts: string[], vsCurrency = 'usd') {
//   return useQuery<SimpleTokenPriceResponse>({
//     queryKey:        ['cg', 'token_price', platform, contracts, vsCurrency],
//     queryFn:         () => api(`/simple/token_price/${platform}?contracts=${contracts.join(',')}&vs=${vsCurrency}`),
//     staleTime:       30_000,
//     refetchInterval: 30_000,
//     enabled:         contracts.length > 0,
//   })
// }

// export function useSupportedCurrencies() {
//   return useQuery<string[]>({
//     queryKey:  ['cg', 'currencies'],
//     queryFn:   () => api('/simple/currencies'),
//     staleTime: Infinity,
//   })
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // 2. Coins
// // ─────────────────────────────────────────────────────────────────────────────

// export function useCoinList() {
//   return useQuery<CoinListItem[]>({
//     queryKey:  ['cg', 'coins', 'list'],
//     queryFn:   () => api('/coins/list'),
//     staleTime: 3_600_000,
//   })
// }

// export function useNewCoins() {
//   return useQuery<NewCoin[]>({
//     queryKey:        ['cg', 'coins', 'new'],
//     queryFn:         () => api('/coins/list/new'),
//     staleTime:       300_000,
//     refetchInterval: 300_000,
//   })
// }

// export interface UseCoinsMarketsOpts {
//   vsCurrency?:   string
//   ids?:          string[]
//   category?:     string
//   order?:        string
//   perPage?:      number
//   page?:         number
//   sparkline?:    boolean
//   priceChange?:  string
// }

// export function useCoinsMarkets(opts: UseCoinsMarketsOpts = {}) {
//   const {
//     vsCurrency = 'usd', ids, category,
//     order = 'market_cap_desc', perPage = 100, page = 1,
//     sparkline = false, priceChange = '1h,24h,7d',
//   } = opts

//   const params = new URLSearchParams({
//     vs: vsCurrency, order,
//     per_page: String(perPage), page: String(page),
//     sparkline: String(sparkline), price_change: priceChange,
//   })
//   if (ids?.length) params.set('ids', ids.join(','))
//   if (category)   params.set('category', category)

//   return useQuery<CoinMarket[]>({
//     queryKey:        ['cg', 'markets', vsCurrency, ids, category, order, perPage, page],
//     queryFn:         () => api(`/coins/markets?${params}`),
//     staleTime:       60_000,
//     refetchInterval: 60_000,
//   })
// }

// export function useTopGainersLosers(
//   vsCurrency = 'usd',
//   duration: '1h' | '24h' | '7d' | '14d' | '30d' | '60d' | '1y' = '24h',
//   topCoins: '300' | '500' | '1000' | 'all' = '1000',
// ) {
//   return useQuery<TopGainersLosersResponse>({
//     queryKey:        ['cg', 'gainers_losers', vsCurrency, duration, topCoins],
//     queryFn:         () => api(`/coins/gainers_losers?vs=${vsCurrency}&duration=${duration}&top=${topCoins}`),
//     staleTime:       60_000,
//     refetchInterval: 60_000,
//   })
// }

// export function useCoinDetail(coinId: string) {
//   return useQuery<CoinDetail>({
//     queryKey:  ['cg', 'detail', coinId],
//     queryFn:   () => api(`/coins/${coinId}`),
//     staleTime: 300_000,
//     enabled:   !!coinId,
//   })
// }

// export function useCoinTickers(coinId: string, page = 1) {
//   return useQuery<CoinTickersResponse>({
//     queryKey:        ['cg', 'tickers', coinId, page],
//     queryFn:         () => api(`/coins/${coinId}/tickers?page=${page}`),
//     staleTime:       60_000,
//     refetchInterval: 60_000,
//     enabled:         !!coinId,
//   })
// }

// export function useCoinHistory(coinId: string, date: string) {
//   return useQuery<CoinHistoryResponse>({
//     queryKey:  ['cg', 'history', coinId, date],
//     queryFn:   () => api(`/coins/${coinId}/history?date=${date}`),
//     staleTime: Infinity, // historical — never changes
//     enabled:   !!coinId && !!date,
//   })
// }

// export function useMarketChart(
//   coinId: string,
//   vsCurrency = 'usd',
//   days: number | 'max' = 7,
//   interval?: 'daily' | 'hourly',
// ) {
//   const q = new URLSearchParams({ vs: vsCurrency, days: String(days) })
//   if (interval) q.set('interval', interval)
//   return useQuery<MarketChartResponse>({
//     queryKey:  ['cg', 'chart', coinId, vsCurrency, days, interval],
//     queryFn:   () => api(`/coins/${coinId}/chart?${q}`),
//     staleTime: 300_000,
//     enabled:   !!coinId,
//   })
// }

// export function useMarketChartRange(
//   coinId: string,
//   from: string,
//   to: string,
//   vsCurrency = 'usd',
// ) {
//   return useQuery<MarketChartResponse>({
//     queryKey:  ['cg', 'chart_range', coinId, vsCurrency, from, to],
//     queryFn:   () => api(`/coins/${coinId}/chart/range?vs=${vsCurrency}&from=${from}&to=${to}`),
//     staleTime: 300_000,
//     enabled:   !!coinId && !!from && !!to,
//   })
// }

// export function useOHLC(
//   coinId: string,
//   vsCurrency = 'usd',
//   days: 1 | 7 | 14 | 30 | 90 | 180 | 365 | 'max' = 7,
// ) {
//   return useQuery<OHLCResponse>({
//     queryKey:  ['cg', 'ohlc', coinId, vsCurrency, days],
//     queryFn:   () => api(`/coins/${coinId}/ohlc?vs=${vsCurrency}&days=${days}`),
//     staleTime: 300_000,
//     enabled:   !!coinId,
//   })
// }

// export function useOHLCRange(
//   coinId: string,
//   from: string,
//   to: string,
//   interval: 'daily' | 'hourly',
//   vsCurrency = 'usd',
// ) {
//   return useQuery<OHLCResponse>({
//     queryKey:  ['cg', 'ohlc_range', coinId, vsCurrency, from, to, interval],
//     queryFn:   () => api(`/coins/${coinId}/ohlc/range?vs=${vsCurrency}&from=${from}&to=${to}&interval=${interval}`),
//     staleTime: 300_000,
//     enabled:   !!coinId && !!from && !!to,
//   })
// }

// export function useCirculatingSupplyChart(coinId: string, days: number | 'max' = 30) {
//   return useQuery<CirculatingSupplyChartResponse>({
//     queryKey:  ['cg', 'supply', 'circ', coinId, days],
//     queryFn:   () => api(`/coins/${coinId}/supply/circulating?days=${days}`),
//     staleTime: 300_000,
//     enabled:   !!coinId,
//   })
// }

// export function useTotalSupplyChart(coinId: string, days: number | 'max' = 30) {
//   return useQuery<TotalSupplyChartResponse>({
//     queryKey:  ['cg', 'supply', 'total', coinId, days],
//     queryFn:   () => api(`/coins/${coinId}/supply/total?days=${days}`),
//     staleTime: 300_000,
//     enabled:   !!coinId,
//   })
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // 3. Contract
// // ─────────────────────────────────────────────────────────────────────────────

// export function useContractDetail(platform: string, address: string) {
//   return useQuery<CoinDetail>({
//     queryKey:  ['cg', 'contract', platform, address],
//     queryFn:   () => api(`/contract/${platform}/${address}`),
//     staleTime: 300_000,
//     enabled:   !!platform && !!address,
//   })
// }

// export function useContractChart(platform: string, address: string, vsCurrency = 'usd', days: number | 'max' = 7) {
//   return useQuery<MarketChartResponse>({
//     queryKey:  ['cg', 'contract_chart', platform, address, vsCurrency, days],
//     queryFn:   () => api(`/contract/${platform}/${address}/chart?vs=${vsCurrency}&days=${days}`),
//     staleTime: 300_000,
//     enabled:   !!platform && !!address,
//   })
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // 4. Asset Platforms
// // ─────────────────────────────────────────────────────────────────────────────

// export function useAssetPlatforms(filter?: 'nft') {
//   return useQuery<AssetPlatform[]>({
//     queryKey:  ['cg', 'platforms', filter],
//     queryFn:   () => api(`/platforms${filter ? '?filter=nft' : ''}`),
//     staleTime: 3_600_000,
//   })
// }

// export function useTokenList(platformId: string) {
//   return useQuery<TokenList>({
//     queryKey:  ['cg', 'token_list', platformId],
//     queryFn:   () => api(`/platforms/${platformId}/tokens`),
//     staleTime: 3_600_000,
//     enabled:   !!platformId,
//   })
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // 5. Categories
// // ─────────────────────────────────────────────────────────────────────────────

// export function useCategoryList() {
//   return useQuery<CategoryListItem[]>({
//     queryKey:  ['cg', 'categories', 'list'],
//     queryFn:   () => api('/categories/list'),
//     staleTime: 3_600_000,
//   })
// }

// export function useCategories(order = 'market_cap_desc') {
//   return useQuery<CategoryMarket[]>({
//     queryKey:        ['cg', 'categories', order],
//     queryFn:         () => api(`/categories?order=${order}`),
//     staleTime:       60_000,
//     refetchInterval: 60_000,
//   })
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // 6. Exchanges
// // ─────────────────────────────────────────────────────────────────────────────

// export function useExchangeList() {
//   return useQuery<ExchangeListItem[]>({
//     queryKey:  ['cg', 'exchanges', 'list'],
//     queryFn:   () => api('/exchanges/list'),
//     staleTime: 3_600_000,
//   })
// }

// export function useExchanges(perPage = 100, page = 1) {
//   return useQuery<Exchange[]>({
//     queryKey:        ['cg', 'exchanges', perPage, page],
//     queryFn:         () => api(`/exchanges?per_page=${perPage}&page=${page}`),
//     staleTime:       120_000,
//     refetchInterval: 120_000,
//   })
// }

// export function useExchange(exchangeId: string) {
//   return useQuery<Exchange>({
//     queryKey:  ['cg', 'exchange', exchangeId],
//     queryFn:   () => api(`/exchanges/${exchangeId}`),
//     staleTime: 120_000,
//     enabled:   !!exchangeId,
//   })
// }

// export function useExchangeTickers(exchangeId: string, coinIds?: string[], page = 1) {
//   const params = new URLSearchParams({ page: String(page) })
//   if (coinIds?.length) params.set('coin_ids', coinIds.join(','))
//   return useQuery<ExchangeTickersResponse>({
//     queryKey:        ['cg', 'exchange_tickers', exchangeId, coinIds, page],
//     queryFn:         () => api(`/exchanges/${exchangeId}/tickers?${params}`),
//     staleTime:       60_000,
//     refetchInterval: 60_000,
//     enabled:         !!exchangeId,
//   })
// }

// export function useExchangeVolumeChart(exchangeId: string, days: 1 | 7 | 14 | 30 | 90 | 180 | 365 = 7) {
//   return useQuery<ExchangeVolumeChart>({
//     queryKey:  ['cg', 'exchange_vol', exchangeId, days],
//     queryFn:   () => api(`/exchanges/${exchangeId}/volume?days=${days}`),
//     staleTime: 300_000,
//     enabled:   !!exchangeId,
//   })
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // 7. Derivatives
// // ─────────────────────────────────────────────────────────────────────────────

// export function useDerivatives() {
//   return useQuery<DerivativeTicker[]>({
//     queryKey:        ['cg', 'derivatives'],
//     queryFn:         () => api('/derivatives'),
//     staleTime:       120_000,
//     refetchInterval: 120_000,
//   })
// }

// export function useDerivativesExchangeList() {
//   return useQuery<DerivativesExchangeListItem[]>({
//     queryKey:  ['cg', 'derivatives', 'exchanges', 'list'],
//     queryFn:   () => api('/derivatives/exchanges/list'),
//     staleTime: 3_600_000,
//   })
// }

// export function useDerivativesExchanges(order = 'open_interest_btc_desc', perPage = 100, page = 1) {
//   return useQuery<DerivativesExchange[]>({
//     queryKey:        ['cg', 'derivatives', 'exchanges', order, perPage, page],
//     queryFn:         () => api(`/derivatives/exchanges?order=${order}&per_page=${perPage}&page=${page}`),
//     staleTime:       120_000,
//     refetchInterval: 120_000,
//   })
// }

// export function useDerivativesExchange(exchangeId: string, tickers?: 'all' | 'unexpired') {
//   return useQuery<DerivativesExchange>({
//     queryKey:  ['cg', 'derivatives', 'exchange', exchangeId, tickers],
//     queryFn:   () => api(`/derivatives/exchanges/${exchangeId}${tickers ? `?tickers=${tickers}` : ''}`),
//     staleTime: 120_000,
//     enabled:   !!exchangeId,
//   })
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // 8. NFTs
// // ─────────────────────────────────────────────────────────────────────────────

// export function useNFTList(order = 'market_cap_usd_desc', perPage = 100, page = 1) {
//   return useQuery<NFTListItem[]>({
//     queryKey:  ['cg', 'nfts', 'list', order, perPage, page],
//     queryFn:   () => api(`/nfts/list?order=${order}&per_page=${perPage}&page=${page}`),
//     staleTime: 120_000,
//   })
// }

// export function useNFTMarkets(platform?: string) {
//   return useQuery<NFTCollection[]>({
//     queryKey:        ['cg', 'nfts', 'markets', platform],
//     queryFn:         () => api(`/nfts/markets${platform ? `?platform=${platform}` : ''}`),
//     staleTime:       120_000,
//     refetchInterval: 120_000,
//   })
// }

// export function useNFT(nftId: string) {
//   return useQuery<NFTCollection>({
//     queryKey:  ['cg', 'nft', nftId],
//     queryFn:   () => api(`/nfts/${nftId}`),
//     staleTime: 120_000,
//     enabled:   !!nftId,
//   })
// }

// export function useNFTTickers(nftId: string) {
//   return useQuery<NFTTickersResponse>({
//     queryKey:        ['cg', 'nft_tickers', nftId],
//     queryFn:         () => api(`/nfts/${nftId}/tickers`),
//     staleTime:       120_000,
//     refetchInterval: 120_000,
//     enabled:         !!nftId,
//   })
// }

// export function useNFTMarketChart(nftId: string, days: number | 'max' = 30) {
//   return useQuery<NFTMarketChartResponse>({
//     queryKey:  ['cg', 'nft_chart', nftId, days],
//     queryFn:   () => api(`/nfts/${nftId}/chart?days=${days}`),
//     staleTime: 300_000,
//     enabled:   !!nftId,
//   })
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // 9. Exchange Rates
// // ─────────────────────────────────────────────────────────────────────────────

// export function useExchangeRates() {
//   return useQuery<ExchangeRatesResponse>({
//     queryKey:        ['cg', 'exchange_rates'],
//     queryFn:         () => api('/exchange_rates'),
//     staleTime:       120_000,
//     refetchInterval: 120_000,
//   })
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // 10. Search
// // ─────────────────────────────────────────────────────────────────────────────

// export function useCoinSearch(query: string) {
//   return useQuery<SearchResponse>({
//     queryKey:  ['cg', 'search', query],
//     queryFn:   () => api(`/search?q=${encodeURIComponent(query)}`),
//     staleTime: 300_000,
//     enabled:   query.length >= 2,
//   })
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // 11. Trending
// // ─────────────────────────────────────────────────────────────────────────────

// export function useTrending() {
//   return useQuery<TrendingResponse>({
//     queryKey:        ['cg', 'trending'],
//     queryFn:         () => api('/trending'),
//     staleTime:       300_000,
//     refetchInterval: 300_000,
//   })
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // 12. Global
// // ─────────────────────────────────────────────────────────────────────────────

// export function useGlobalMarket() {
//   return useQuery<GlobalResponse>({
//     queryKey:        ['cg', 'global'],
//     queryFn:         () => api('/global'),
//     staleTime:       120_000,
//     refetchInterval: 120_000,
//   })
// }

// export function useGlobalDeFi() {
//   return useQuery<GlobalDeFiResponse>({
//     queryKey:        ['cg', 'global', 'defi'],
//     queryFn:         () => api('/global/defi'),
//     staleTime:       120_000,
//     refetchInterval: 120_000,
//   })
// }

// export function useGlobalMarketCapChart(days: number | 'max' = 30, vsCurrency = 'usd') {
//   return useQuery<GlobalMarketCapChartResponse>({
//     queryKey:  ['cg', 'global_chart', days, vsCurrency],
//     queryFn:   () => api(`/global/chart?days=${days}&vs=${vsCurrency}`),
//     staleTime: 300_000,
//   })
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // 13. Companies / Treasury
// // ─────────────────────────────────────────────────────────────────────────────

// export function useEntityList(type: 'company' | 'government' = 'company') {
//   return useQuery<EntityListItem[]>({
//     queryKey:  ['cg', 'entities', type],
//     queryFn:   () => api(`/entities/list?type=${type}`),
//     staleTime: 300_000,
//   })
// }

// export function usePublicTreasury(
//   coinId: 'bitcoin' | 'ethereum',
//   entity: 'companies' | 'governments' = 'companies',
// ) {
//   return useQuery<PublicTreasuryResponse>({
//     queryKey:  ['cg', 'treasury', entity, coinId],
//     queryFn:   () => api(`/treasury/${entity}/${coinId}`),
//     staleTime: 300_000,
//     enabled:   !!coinId,
//   })
// }

// export function useEntityDetail(entityId: string) {
//   return useQuery<EntityDetail>({
//     queryKey:  ['cg', 'entity', entityId],
//     queryFn:   () => api(`/treasury/entity/${entityId}`),
//     staleTime: 300_000,
//     enabled:   !!entityId,
//   })
// }

// export function useEntityHoldingChart(
//   entityId: string,
//   coinId: string,
//   days: 7 | 14 | 30 | 90 | 180 | 365 | 730 | 'max' = 365,
// ) {
//   return useQuery<EntityHoldingChartResponse>({
//     queryKey:  ['cg', 'entity_chart', entityId, coinId, days],
//     queryFn:   () => api(`/treasury/entity/${entityId}/${coinId}/chart?days=${days}`),
//     staleTime: 300_000,
//     enabled:   !!entityId && !!coinId,
//   })
// }

// export function useEntityTransactions(entityId: string, coinIds?: string[], page = 1) {
//   const params = new URLSearchParams({ page: String(page) })
//   if (coinIds?.length) params.set('coin_ids', coinIds.join(','))
//   return useQuery<EntityTransactionHistoryResponse>({
//     queryKey:  ['cg', 'entity_txns', entityId, coinIds, page],
//     queryFn:   () => api(`/treasury/entity/${entityId}/transactions?${params}`),
//     staleTime: 300_000,
//     enabled:   !!entityId,
//   })
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // News — your NewsService (RSS), re-exported for convenience
// // ─────────────────────────────────────────────────────────────────────────────
// export { useNewsFeed, useCoinNews } from './useNewsFeed'
