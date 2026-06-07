/**
 * CoinGecko API v3 — Complete TypeScript Models
 * Sourced directly from the Demo Plan API reference.
 * Covers all 13 endpoint groups available on the Demo plan.
 */

// ─── Shared primitives ────────────────────────────────────────────────────────

/** [unix_ms, value] — used by all chart endpoints */
export type ChartPoint = [number, number]

/** [close_time_ms, open, high, low, close] */
export type OHLCPoint = [number, number, number, number, number]

// ─── 1. Simple ────────────────────────────────────────────────────────────────

/**
 * GET /simple/price
 * Key = coinId, value = currency fields depending on `include_*` params.
 * Example: { bitcoin: { usd: 67187.33, usd_24h_change: 3.637, last_updated_at: 1711356300 } }
 */
export type SimplePriceResponse = Record<string, Record<string, number>>

/**
 * GET /simple/token_price/{id}
 * Key = contract address
 */
export type SimpleTokenPriceResponse = Record<string, Record<string, number>>

/** GET /simple/supported_vs_currencies */
export type SupportedVsCurrencies = string[]

// ─── 2. Coins ─────────────────────────────────────────────────────────────────

/** GET /coins/list */
export interface CoinListItem {
  id:        string
  symbol:    string
  name:      string
  platforms?: Record<string, string>
}

/** GET /coins/list/new */
export interface NewCoin {
  id:           string
  symbol:       string
  name:         string
  activated_at: number // unix seconds
}

/** GET /coins/markets — single coin row */
export interface CoinMarket {
  id:                                    string
  symbol:                                string
  name:                                  string
  image:                                 string
  current_price:                         number
  market_cap:                            number
  market_cap_rank:                       number
  fully_diluted_valuation:               number | null
  total_volume:                          number
  high_24h:                              number
  low_24h:                               number
  price_change_24h:                      number
  price_change_percentage_24h:           number
  market_cap_change_24h:                 number
  market_cap_change_percentage_24h:      number
  circulating_supply:                    number
  total_supply:                          number | null
  max_supply:                            number | null
  ath:                                   number
  ath_change_percentage:                 number
  ath_date:                              string
  atl:                                   number
  atl_change_percentage:                 number
  atl_date:                              string
  roi:                                   CoinROI | null
  last_updated:                          string
  // optional — only present when requested
  sparkline_in_7d?:                      { price: number[] }
  price_change_percentage_1h_in_currency?:    number
  price_change_percentage_24h_in_currency?:   number
  price_change_percentage_7d_in_currency?:    number
  price_change_percentage_14d_in_currency?:   number
  price_change_percentage_30d_in_currency?:   number
  price_change_percentage_200d_in_currency?:  number
  price_change_percentage_1y_in_currency?:    number
}

export interface CoinROI {
  times:      number
  currency:   string
  percentage: number
}

/** GET /coins/top_gainers_losers — single gainer/loser row */
export interface GainerLoser {
  id:             string
  symbol:         string
  name:           string
  image?:         string
  market_cap_rank?: number
  usd:            number
  usd_24h_vol:    number
  usd_24h_change: number
}

/** GET /coins/top_gainers_losers */
export interface TopGainersLosersResponse {
  top_gainers: GainerLoser[]
  top_losers:  GainerLoser[]
}

/** GET /coins/{id} — full coin detail */
export interface CoinDetail {
  id:                  string
  symbol:              string
  name:                string
  asset_platform_id:   string | null
  platforms:           Record<string, string>
  detail_platforms:    Record<string, { decimal_place: number; contract_address: string }>
  categories:          string[]
  description:         Record<string, string>
  links:               CoinLinks
  image:               { thumb: string; small: string; large: string }
  country_origin:      string
  genesis_date:        string | null
  market_cap_rank:     number
  market_data:         CoinMarketData
  community_data:      CoinCommunityData
  developer_data:      CoinDeveloperData
  sentiment_votes_up_percentage:   number
  sentiment_votes_down_percentage: number
  watchlist_portfolio_users: number
  last_updated:        string
}

export interface CoinLinks {
  homepage:                    string[]
  whitepaper:                  string
  blockchain_site:             string[]
  official_forum_url:          string[]
  chat_url:                    string[]
  announcement_url:            string[]
  twitter_screen_name:         string
  facebook_username:           string
  telegram_channel_identifier: string
  subreddit_url:               string
  repos_url:                   { github: string[]; bitbucket: string[] }
}

export interface CoinMarketData {
  current_price:                Record<string, number>
  ath:                          Record<string, number>
  ath_change_percentage:        Record<string, number>
  ath_date:                     Record<string, string>
  atl:                          Record<string, number>
  atl_change_percentage:        Record<string, number>
  atl_date:                     Record<string, string>
  market_cap:                   Record<string, number>
  market_cap_rank:              number
  total_volume:                 Record<string, number>
  high_24h:                     Record<string, number>
  low_24h:                      Record<string, number>
  price_change_24h:             number
  price_change_percentage_24h:  number
  price_change_percentage_7d:   number
  price_change_percentage_14d:  number
  price_change_percentage_30d:  number
  price_change_percentage_1y:   number
  circulating_supply:           number
  total_supply:                 number | null
  max_supply:                   number | null
  last_updated:                 string
}

export interface CoinCommunityData {
  facebook_likes:               number | null
  twitter_followers:            number
  reddit_average_posts_48h:     number
  reddit_average_comments_48h:  number
  reddit_subscribers:           number
  reddit_accounts_active_48h:   number
  telegram_channel_user_count:  number | null
}

export interface CoinDeveloperData {
  forks:                       number
  stars:                       number
  subscribers:                 number
  total_issues:                number
  closed_issues:               number
  pull_requests_merged:        number
  pull_request_contributors:   number
  code_additions_deletions_4_weeks: { additions: number; deletions: number }
  commit_activity_4_weeks:     number
  last_4_weeks_commit_activity_series: number[]
}

/** GET /coins/{id}/tickers */
export interface CoinTickersResponse {
  name:    string
  tickers: Ticker[]
}

export interface Ticker {
  base:   string
  target: string
  market: { name: string; identifier: string; has_trading_incentive: boolean }
  last:   number
  volume: number
  converted_last:   Record<string, number>
  converted_volume: Record<string, number>
  bid_ask_spread_percentage: number
  timestamp:        string
  is_anomaly:       boolean
  is_stale:         boolean
  trade_url:        string | null
  coin_id:          string
  target_coin_id?:  string
  trust_score:      string | null
}

/** GET /coins/{id}/history */
export interface CoinHistoryResponse {
  id:     string
  symbol: string
  name:   string
  image:  { thumb: string; small: string }
  market_data: {
    current_price: Record<string, number>
    market_cap:    Record<string, number>
    total_volume:  Record<string, number>
  }
}

/** GET /coins/{id}/market_chart and /market_chart/range */
export interface MarketChartResponse {
  prices:        ChartPoint[]
  market_caps:   ChartPoint[]
  total_volumes: ChartPoint[]
}

/** GET /coins/{id}/ohlc and /ohlc/range — [close_time_ms, open, high, low, close] */
export type OHLCResponse = OHLCPoint[]

/** GET /coins/{id}/circulating_supply_chart */
export interface CirculatingSupplyChartResponse {
  circulating_supply: ChartPoint[]
}

/** GET /coins/{id}/total_supply_chart */
export interface TotalSupplyChartResponse {
  total_supply: ChartPoint[]
}

// ─── 3. Contract ──────────────────────────────────────────────────────────────
// Same shape as CoinDetail — reuse the type, contract adds detail_platforms

// ─── 4. Asset Platforms ───────────────────────────────────────────────────────

export interface AssetPlatform {
  id:              string
  chain_identifier: number | null
  name:            string
  shortname:       string
  native_coin_id:  string
  image:           { thumb: string; small: string; large: string }
}

export interface TokenList {
  name:      string
  logoURI:   string
  keywords:  string[]
  timestamp: string
  tokens:    TokenListItem[]
}

export interface TokenListItem {
  chainId:  number
  address:  string
  name:     string
  symbol:   string
  decimals: number
  logoURI:  string
}

// ─── 5. Categories ────────────────────────────────────────────────────────────

export interface CategoryListItem {
  category_id: string
  name:        string
}

export interface CategoryMarket {
  id:                    string
  name:                  string
  market_cap:            number
  market_cap_change_24h: number
  content:               string
  top_3_coins_id:        string[]
  top_3_coins:           string[]
  volume_24h:            number
  updated_at:            string
}

// ─── 6. Exchanges ─────────────────────────────────────────────────────────────

export interface ExchangeListItem {
  id:   string
  name: string
}

export interface Exchange {
  id:                    string
  name:                  string
  year_established:      number | null
  country:               string | null
  url:                   string
  image:                 string
  trust_score:           number
  trust_score_rank:      number
  trade_volume_24h_btc:  number
  centralized?:          boolean
  coins?:                number
  pairs?:                number
  tickers?:              Ticker[]
}

export interface ExchangeTickersResponse {
  name:    string
  tickers: Ticker[]
}

/** GET /exchanges/{id}/volume_chart — [ms_timestamp, volume_in_btc_string] */
export type ExchangeVolumeChart = [number, string][]

// ─── 7. Derivatives ───────────────────────────────────────────────────────────

export interface DerivativeTicker {
  market:                    string
  symbol:                    string
  index_id:                  string
  price:                     string
  price_percentage_change_24h: number
  contract_type:             string
  index:                     number
  basis:                     number
  spread:                    number
  funding_rate:              number
  open_interest:             number
  volume_24h:                number
  last_traded_at:            number
  expired_at:                number | null
}

export interface DerivativesExchangeListItem {
  id:   string
  name: string
}

export interface DerivativesExchange {
  name:                     string
  id:                       string
  open_interest_btc:        number
  trade_volume_24h_btc:     string
  number_of_perpetual_pairs: number
  number_of_futures_pairs:  number
  image:                    string
  year_established:         number | null
  country:                  string | null
  url:                      string
  tickers?:                 DerivativeExchangeTicker[]
}

export interface DerivativeExchangeTicker {
  symbol:              string
  base:                string
  target:              string
  contract_type:       string
  last:                number
  h24_percentage_change: number
  funding_rate:        number
  open_interest_usd:   number
  converted_volume:    Record<string, string>
  last_traded:         number
  expired_at:          number | null
}

// ─── 8. NFTs (Beta) ───────────────────────────────────────────────────────────

export interface NFTListItem {
  id:                  string
  contract_address:    string
  name:                string
  asset_platform_id:   string
  symbol:              string
}

export interface NFTCollection {
  id:                     string
  contract_address:       string
  asset_platform_id:      string
  name:                   string
  symbol:                 string
  native_currency:        string
  native_currency_symbol: string
  market_cap_rank:        number
  floor_price:            { native_currency: number; usd: number }
  market_cap:             { native_currency: number; usd: number }
  volume_24h:             { native_currency: number; usd: number }
  total_supply:           number
  ath:                    { native_currency: number; usd: number }
}

export interface NFTTickerItem {
  floor_price_in_native_currency:  number
  h24_volume_in_native_currency:   number
  native_currency:                 string
  native_currency_symbol:          string
  updated_at:                      string
  nft_marketplace_id:              string
  name:                            string
  image:                           string
  nft_collection_url:              string
}

export interface NFTTickersResponse {
  tickers: NFTTickerItem[]
}

export interface NFTMarketChartResponse {
  floor_price_usd:       ChartPoint[]
  floor_price_native:    ChartPoint[]
  h24_volume_usd:        ChartPoint[]
  h24_volume_native:     ChartPoint[]
  market_cap_usd:        ChartPoint[]
  market_cap_native:     ChartPoint[]
}

// ─── 9. Exchange Rates ────────────────────────────────────────────────────────

export interface ExchangeRatesResponse {
  rates: Record<string, {
    name:  string
    unit:  string
    value: number
    type:  'crypto' | 'fiat' | 'commodity'
  }>
}

// ─── 10. Search ───────────────────────────────────────────────────────────────

export interface SearchResponse {
  coins:      SearchCoin[]
  exchanges:  SearchExchange[]
  categories: SearchCategory[]
  nfts:       SearchNFT[]
  icos:       unknown[]
}

export interface SearchCoin     { id: string; name: string; api_symbol: string; symbol: string; market_cap_rank: number; thumb: string; large: string }
export interface SearchExchange { id: string; name: string; market_type: string; thumb: string; large: string }
export interface SearchCategory { id: string; name: string }
export interface SearchNFT      { id: string; name: string; symbol: string; thumb: string }

// ─── 11. Trending ─────────────────────────────────────────────────────────────

export interface TrendingResponse {
  coins:      TrendingCoinItem[]
  nfts:       TrendingNFT[]
  categories: TrendingCategory[]
}

export interface TrendingCoinItem {
  item: {
    id:              string
    coin_id:         number
    name:            string
    symbol:          string
    market_cap_rank: number
    price_btc:       number
    score:           number
    data: {
      price:                       number
      price_change_percentage_24h: Record<string, number>
      market_cap:                  string
      total_volume:                string
      sparkline:                   string
    }
  }
}

export interface TrendingNFT {
  id:                             string
  name:                           string
  symbol:                         string
  native_currency_symbol:         string
  floor_price_in_native_currency: number
  floor_price_24h_percentage_change: number
}

export interface TrendingCategory {
  id:                  number
  name:                string
  slug:                string
  coins_count:         number
  data: {
    market_cap:   number
    total_volume: number
  }
}

// ─── 12. Global ───────────────────────────────────────────────────────────────

export interface GlobalResponse {
  data: {
    active_cryptocurrencies:              number
    upcoming_icos:                        number
    ongoing_icos:                         number
    ended_icos:                           number
    markets:                              number
    total_market_cap:                     Record<string, number>
    total_volume:                         Record<string, number>
    market_cap_percentage:                Record<string, number>
    market_cap_change_percentage_24h_usd: number
    volume_change_percentage_24h_usd:     number
    updated_at:                           number
  }
}

export interface GlobalDeFiResponse {
  data: {
    defi_market_cap:       string
    eth_market_cap:        string
    defi_to_eth_ratio:     string
    trading_volume_24h:    string
    defi_dominance:        string
    top_coin_name:         string
    top_coin_defi_dominance: number
  }
}

export interface GlobalMarketCapChartResponse {
  market_cap_chart: {
    market_cap: ChartPoint[]
    volume:     ChartPoint[]
  }
}

// ─── 13. Companies / Treasury ─────────────────────────────────────────────────

export interface EntityListItem {
  id:      string
  symbol:  string
  name:    string
  country: string
}

export interface PublicTreasuryResponse {
  total_holdings:       number
  total_value_usd:      number
  market_cap_dominance: number
  companies:            PublicTreasuryCompany[]
}

export interface PublicTreasuryCompany {
  name:                    string
  symbol:                  string
  country:                 string
  total_holdings:          number
  total_entry_value_usd:   number
  total_current_value_usd: number
  percentage_of_total_supply: number
}

export interface EntityDetail {
  name:                  string
  id:                    string
  type:                  'company' | 'government'
  symbol:                string
  country:               string
  total_treasury_value_usd: number
  unrealized_pnl:        number
  holdings:              EntityHolding[]
}

export interface EntityHolding {
  coin_id:                    string
  amount:                     number
  percentage_of_total_supply: number
  current_value_usd:          number
  total_entry_value_usd:      number
  average_entry_value_usd:    number
  holding_amount_change?:     Record<string, number>
  holding_change_percentage?: Record<string, number>
}

export interface EntityHoldingChartResponse {
  holdings:             ChartPoint[]
  holding_value_in_usd: ChartPoint[]
}

export interface EntityTransaction {
  date:                  number // unix ms
  source_url:            string
  coin_id:               string
  type:                  'buy' | 'sell'
  holding_net_change:    number
  transaction_value_usd: number
  holding_balance:       number
  average_entry_value_usd: number
}

export interface EntityTransactionHistoryResponse {
  transactions: EntityTransaction[]
}
