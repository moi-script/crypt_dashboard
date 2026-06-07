/**
 * CoinGecko Express Router
 * Mount: app.use('/api', coinGeckoRouter)
 *
 * All routes proxy through CoinGeckoService (Redis-cached).
 * News routes delegate to your existing NewsService (RSS feeds).
 *
 * ── Route map ──────────────────────────────────────────────────────────────
 * GET /api/ping
 *
 * Simple
 * GET /api/simple/price              ?ids=bitcoin,ethereum&vs=usd
 * GET /api/simple/token_price/:platform  ?contracts=0x...&vs=usd
 * GET /api/simple/currencies
 *
 * Coins
 * GET /api/coins/list
 * GET /api/coins/list/new
 * GET /api/coins/markets             ?vs=usd&per_page=100&page=1&sparkline=false&ids=...&category=...
 * GET /api/coins/gainers_losers      ?vs=usd&duration=24h&top=1000
 * GET /api/coins/:coinId             (detail)
 * GET /api/coins/:coinId/tickers     ?page=1
 * GET /api/coins/:coinId/history     ?date=DD-MM-YYYY
 * GET /api/coins/:coinId/chart       ?vs=usd&days=7
 * GET /api/coins/:coinId/chart/range ?vs=usd&from=YYYY-MM-DD&to=YYYY-MM-DD
 * GET /api/coins/:coinId/ohlc        ?vs=usd&days=7
 * GET /api/coins/:coinId/ohlc/range  ?vs=usd&from=YYYY-MM-DD&to=YYYY-MM-DD&interval=daily
 * GET /api/coins/:coinId/supply/circulating ?days=30
 * GET /api/coins/:coinId/supply/total       ?days=30
 *
 * Contract
 * GET /api/contract/:platform/:address
 * GET /api/contract/:platform/:address/chart  ?vs=usd&days=7
 *
 * Asset Platforms
 * GET /api/platforms
 * GET /api/platforms/:platformId/tokens
 *
 * Categories
 * GET /api/categories/list
 * GET /api/categories             ?order=market_cap_desc
 *
 * Exchanges
 * GET /api/exchanges/list
 * GET /api/exchanges              ?per_page=100&page=1
 * GET /api/exchanges/:exchangeId
 * GET /api/exchanges/:exchangeId/tickers  ?page=1&coin_ids=bitcoin
 * GET /api/exchanges/:exchangeId/volume   ?days=7
 *
 * Derivatives
 * GET /api/derivatives
 * GET /api/derivatives/exchanges/list
 * GET /api/derivatives/exchanges       ?order=open_interest_btc_desc
 * GET /api/derivatives/exchanges/:id   ?tickers=unexpired
 *
 * NFTs
 * GET /api/nfts/list              ?order=market_cap_usd_desc
 * GET /api/nfts/markets           ?platform=ethereum
 * GET /api/nfts/:nftId
 * GET /api/nfts/:nftId/tickers
 * GET /api/nfts/:nftId/chart      ?days=30
 *
 * Exchange Rates
 * GET /api/exchange_rates
 *
 * Search
 * GET /api/search                 ?q=ethereum
 *
 * Trending
 * GET /api/trending
 *
 * Global
 * GET /api/global
 * GET /api/global/defi
 * GET /api/global/chart           ?days=30&vs=usd
 *
 * Companies / Treasury
 * GET /api/entities/list          ?type=company
 * GET /api/treasury/:entity/:coinId                (companies | governments)
 * GET /api/treasury/entity/:entityId
 * GET /api/treasury/entity/:entityId/:coinId/chart ?days=365
 * GET /api/treasury/entity/:entityId/transactions  ?page=1
 *
 * News (your NewsService — RSS feeds)
 * GET /api/news                   ?limit=20
 * GET /api/news/coin/:coinId      ?limit=10
 */

import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { CoinGeckoService } from '../services/coingecko.service'
import { NewsService } from '../services/news.service'
import { AppError } from '../middleware/errorHandler'
const router = Router()
const cg     = new CoinGeckoService()
const news   = new NewsService()

function wrap(fn: (req: Request) => Promise<unknown>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await fn(req)) } catch (err) { next(err) }
  }
}
function isInvalidId(id: string | undefined): boolean {
  return !id || id === 'undefined' || id === 'null' || id.trim() === ''
}

// ── Ping ──────────────────────────────────────────────────────────────────────
router.get('/ping', wrap(() => cg.ping()))

// ── Simple ────────────────────────────────────────────────────────────────────
router.get('/simple/price', wrap((req) => {
  const ids = String(req.query.ids ?? 'bitcoin').split(',').filter(Boolean)
  const vs  = String(req.query.vs  ?? 'usd').split(',')
  return cg.getSimplePrices(ids, vs, {
    includeMarketCap:   true,
    include24hVol:      true,
    include24hChange:   true,
    includeLastUpdated: true,
    precision:          req.query.precision ? String(req.query.precision) : undefined,
  })
}))

router.get('/simple/token_price/:platform', wrap((req) => {
  const contracts = String(req.query.contracts ?? '').split(',').filter(Boolean)
  const vs = String(req.query.vs ?? 'usd').split(',')
  return cg.getTokenPrices(req.params.platform as string, contracts, vs)
}))

router.get('/simple/currencies', wrap(() => cg.getSupportedCurrencies()))

// ── Coins ─────────────────────────────────────────────────────────────────────
router.get('/coins/list',     wrap(() => cg.getCoinList(true)))
router.get('/coins/list/new', wrap(() => cg.getNewCoins()))

router.get('/coins/markets', wrap((req) => {
  const ids = req.query.ids ? String(req.query.ids).split(',') : undefined
  return cg.getCoinsMarkets({
    vsCurrency:            String(req.query.vs       ?? 'usd'),
    ids,
    category:              req.query.category ? String(req.query.category) : undefined,
    order:                 (req.query.order as any) ?? 'market_cap_desc',
    perPage:               Number(req.query.per_page ?? 100),
    page:                  Number(req.query.page     ?? 1),
    sparkline:             req.query.sparkline === 'true',
    priceChangePercentage: String(req.query.price_change ?? '1h,24h,7d'),
    precision:             req.query.precision ? String(req.query.precision) : undefined,
  })
}))

router.get('/coins/gainers_losers', wrap((req) =>
  cg.getTopGainersLosers(
    String(req.query.vs       ?? 'usd'),
    (req.query.duration as any) ?? '24h',
    (req.query.top      as any) ?? '1000',
  )
))

// !! Specific sub-paths must come before /:coinId
router.get('/coins/:coinId/tickers',            wrap((req) => cg.getCoinTickers(req.params.coinId as string, Number(req.query.page ?? 1))))
router.get('/coins/:coinId/history',            wrap((req) => cg.getCoinHistory(req.params.coinId as string, String(req.query.date ?? ''))))
router.get('/coins/:coinId/chart/range',        wrap((req) => cg.getMarketChartRange(req.params.coinId as string, String(req.query.from), String(req.query.to), String(req.query.vs ?? 'usd'))))
router.get('/coins/:coinId/chart',              wrap((req) => cg.getMarketChart(req.params.coinId as string, String(req.query.vs ?? 'usd'), req.query.days === 'max' ? 'max' : Number(req.query.days ?? 7))))
router.get('/coins/:coinId/ohlc/range',         wrap((req) => cg.getOHLCRange(req.params.coinId as string, String(req.query.from), String(req.query.to), (req.query.interval as any) ?? 'daily', String(req.query.vs ?? 'usd'))))
router.get('/coins/:coinId/ohlc',               wrap((req) => cg.getOHLC(req.params.coinId as string, String(req.query.vs ?? 'usd'), (req.query.days as any) ?? 7)))
router.get('/coins/:coinId/supply/circulating', wrap((req) => cg.getCirculatingSupplyChart(req.params.coinId as string, req.query.days === 'max' ? 'max' : Number(req.query.days ?? 30))))
router.get('/coins/:coinId/supply/total',       wrap((req) => cg.getTotalSupplyChart(req.params.coinId as string, req.query.days === 'max' ? 'max' : Number(req.query.days ?? 30))))
// router.get('/coins/:coinId',                    wrap((req) => cg.getCoinDetail(req.params.coinId as string, { marketData: true, communityData: true })))

router.get('/coins/:coinId', wrap((req) => {
  if (isInvalidId(req.params.coinId as string)) throw new AppError(400, 'Coin ID is required')
  return cg.getCoinDetail(req.params.coinId as string, { marketData: true, communityData: true })
}))
// ── Contract ──────────────────────────────────────────────────────────────────
router.get('/contract/:platform/:address/chart', wrap((req) =>
  cg.getContractChart(req.params.platform as string, req.params.address as string, String(req.query.vs ?? 'usd'), req.query.days === 'max' ? 'max' : Number(req.query.days ?? 7))
))
router.get('/contract/:platform/:address', wrap((req) =>
  cg.getContractDetail(req.params.platform as string, req.params.address as string)
))

// ── Asset Platforms ───────────────────────────────────────────────────────────
router.get('/platforms/:platformId/tokens', wrap((req) => cg.getTokenList(req.params.platformId as string)))
router.get('/platforms',                    wrap((req) => cg.getAssetPlatforms(req.query.filter === 'nft' ? 'nft' : undefined)))

// ── Categories ────────────────────────────────────────────────────────────────
router.get('/categories/list', wrap(() => cg.getCategoryList()))
router.get('/categories',      wrap((req) => cg.getCategories(String(req.query.order ?? 'market_cap_desc'))))

// ── Exchanges ─────────────────────────────────────────────────────────────────
router.get('/exchanges/list',                        wrap(() => cg.getExchangeList()))
router.get('/exchanges/:exchangeId/tickers',         wrap((req) => {
  const coinIds = req.query.coin_ids ? String(req.query.coin_ids).split(',') : undefined
  return cg.getExchangeTickers(req.params.exchangeId as string, coinIds, Number(req.query.page ?? 1))
}))
router.get('/exchanges/:exchangeId/volume',          wrap((req) => cg.getExchangeVolumeChart(req.params.exchangeId as string, (Number(req.query.days ?? 7) as any))))
router.get('/exchanges/:exchangeId',                 wrap((req) => cg.getExchange(req.params.exchangeId as string)))
router.get('/exchanges',                             wrap((req) => cg.getExchanges(Number(req.query.per_page ?? 100), Number(req.query.page ?? 1))))

// ── Derivatives ───────────────────────────────────────────────────────────────
router.get('/derivatives/exchanges/list',    wrap(() => cg.getDerivativesExchangeList()))
router.get('/derivatives/exchanges/:id',     wrap((req) => cg.getDerivativesExchange(req.params.id as string, (req.query.tickers as any))))
router.get('/derivatives/exchanges',         wrap((req) => cg.getDerivativesExchanges(String(req.query.order ?? 'open_interest_btc_desc'), Number(req.query.per_page ?? 100), Number(req.query.page ?? 1))))
router.get('/derivatives',                   wrap(() => cg.getDerivatives()))

// ── NFTs ──────────────────────────────────────────────────────────────────────
router.get('/nfts/list',           wrap((req) => cg.getNFTList(String(req.query.order ?? 'market_cap_usd_desc'), Number(req.query.per_page ?? 100), Number(req.query.page ?? 1))))
router.get('/nfts/markets',        wrap((req) => cg.getNFTMarkets(req.query.platform ? String(req.query.platform) : undefined)))
router.get('/nfts/:nftId/tickers', wrap((req) => cg.getNFTTickers(req.params.nftId as string)))
router.get('/nfts/:nftId/chart',   wrap((req) => cg.getNFTMarketChart(req.params.nftId as string, req.query.days === 'max' ? 'max' : Number(req.query.days ?? 30))))
router.get('/nfts/:nftId',         wrap((req) => cg.getNFT(req.params.nftId as string)))

// ── Exchange Rates ────────────────────────────────────────────────────────────
router.get('/exchange_rates', wrap(() => cg.getExchangeRates()))

// ── Search ────────────────────────────────────────────────────────────────────
router.get('/search', wrap((req) => {
  const q = String(req.query.q ?? '').trim()
  if (!q) return Promise.resolve({ coins: [], exchanges: [], categories: [], nfts: [], icos: [] })
  return cg.search(q)
}))

// ── Trending ──────────────────────────────────────────────────────────────────
router.get('/trending', wrap(() => cg.getTrending()))

// ── Global ────────────────────────────────────────────────────────────────────
router.get('/global/defi',  wrap(() => cg.getGlobalDeFi()))
router.get('/global/chart', wrap((req) => cg.getGlobalMarketCapChart(req.query.days === 'max' ? 'max' : Number(req.query.days ?? 30), String(req.query.vs ?? 'usd'))))
router.get('/global',       wrap(() => cg.getGlobal()))

// ── Companies / Treasury ──────────────────────────────────────────────────────
router.get('/entities/list', wrap((req) => cg.getEntityList((req.query.type as any) ?? 'company')))

router.get('/treasury/:entity/:coinId', wrap((req) =>
  cg.getPublicTreasury(
    req.params.coinId as any,
    req.params.entity as any,
  )
))

router.get('/treasury/entity/:entityId/transactions', wrap((req) => {
  const coinIds = req.query.coin_ids ? String(req.query.coin_ids).split(',') : undefined
  return cg.getEntityTransactionHistory(req.params.entityId as string, coinIds, Number(req.query.page ?? 1))
}))

router.get('/treasury/entity/:entityId/:coinId/chart', wrap((req) =>
  cg.getEntityHoldingChart(req.params.entityId as string, req.params.coinId as string, (req.query.days as any) ?? 365)
))

router.get('/treasury/entity/:entityId', wrap((req) =>
  cg.getEntityDetail(req.params.entityId as string)
))

// ── News (RSS via NewsService — not CoinGecko) ────────────────────────────────
router.get('/news/coin/:coinId', wrap((req) => news.getForCoin(req.params.coinId as string, Number(req.query.limit ?? 10))))
router.get('/news',              wrap((req) => news.getLatest(Number(req.query.limit ?? 20))))

export { router as coinGeckoRouter }