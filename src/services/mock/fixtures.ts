import type { Coin, Indicator, OHLCVBar, OHLCVRange } from "@/models/coin.model";
import type { NewsArticle } from "@/models/news.model";

/* Deterministic PRNG so demo data is stable within a session but varied per id. */
function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

interface Seed {
  id: string;
  symbol: string;
  name: string;
  price: number;
  rank: number;
}

const SEEDS: Seed[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 67412.08, rank: 1 },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3548.22, rank: 2 },
  { id: "tether", symbol: "USDT", name: "Tether", price: 1.0, rank: 3 },
  { id: "binancecoin", symbol: "BNB", name: "BNB", price: 612.45, rank: 4 },
  { id: "solana", symbol: "SOL", name: "Solana", price: 168.9, rank: 5 },
  { id: "ripple", symbol: "XRP", name: "XRP", price: 0.624, rank: 6 },
  { id: "cardano", symbol: "ADA", name: "Cardano", price: 0.452, rank: 7 },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", price: 0.158, rank: 8 },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche", price: 36.71, rank: 9 },
  { id: "chainlink", symbol: "LINK", name: "Chainlink", price: 17.83, rank: 10 },
  { id: "polkadot", symbol: "DOT", name: "Polkadot", price: 7.12, rank: 11 },
  { id: "polygon", symbol: "MATIC", name: "Polygon", price: 0.721, rank: 12 },
  { id: "litecoin", symbol: "LTC", name: "Litecoin", price: 84.2, rank: 13 },
  { id: "uniswap", symbol: "UNI", name: "Uniswap", price: 10.44, rank: 14 },
  { id: "cosmos", symbol: "ATOM", name: "Cosmos", price: 8.93, rank: 15 },
  { id: "stellar", symbol: "XLM", name: "Stellar", price: 0.112, rank: 16 },
];

function sparkline(rng: () => number, base: number, drift: number): number[] {
  const pts: number[] = [];
  let v = base * (1 - drift / 100);
  for (let i = 0; i < 24; i++) {
    v *= 1 + (rng() - 0.48) * 0.012;
    pts.push(v);
  }
  pts[pts.length - 1] = base;
  return pts;
}

export function mockCoins(): Coin[] {
  return SEEDS.map((s) => {
    const rng = seeded(hash(s.id));
    const stable = s.symbol === "USDT";
    const change24h = stable ? (rng() - 0.5) * 0.05 : (rng() - 0.42) * 11;
    const volume24h = s.price * (1_000_000 + rng() * 40_000_000) * (17 - s.rank);
    const marketCap = s.price * (1 + rng()) * (40_000_000_000 / s.rank);
    return {
      id: s.id,
      symbol: s.symbol,
      name: s.name,
      price: s.price,
      change24h,
      volume24h,
      marketCap,
      rank: s.rank,
      image: `https://assets.coingecko.com/coins/images/${s.rank}/small/${s.id}.png`,
      sparkline: sparkline(rng, s.price, change24h),
    };
  });
}

export function mockCoin(id: string): Coin | undefined {
  return mockCoins().find((c) => c.id === id);
}

const RANGE_BARS: Record<OHLCVRange, { count: number; stepSec: number }> = {
  "1D": { count: 96, stepSec: 15 * 60 },
  "1W": { count: 168, stepSec: 60 * 60 },
  "1M": { count: 180, stepSec: 4 * 60 * 60 },
  "1Y": { count: 365, stepSec: 24 * 60 * 60 },
};

export function mockOHLCV(id: string, range: OHLCVRange): OHLCVBar[] {
  const coin = mockCoin(id);
  const base = coin?.price ?? 100;
  const { count, stepSec } = RANGE_BARS[range];
  const rng = seeded(hash(id + range));
  const now = Math.floor(Date.now() / 1000);
  const start = now - count * stepSec;
  const vol = base * 0.018;

  const bars: OHLCVBar[] = [];
  let close = base * (0.82 + rng() * 0.12);
  for (let i = 0; i < count; i++) {
    const open = close;
    const drift = (rng() - 0.5) * vol * 2 + (base - open) * 0.015;
    close = Math.max(open + drift, base * 0.05);
    const high = Math.max(open, close) * (1 + rng() * 0.01);
    const low = Math.min(open, close) * (1 - rng() * 0.01);
    bars.push({
      time: start + i * stepSec,
      open,
      high,
      low,
      close,
      volume: base * (500 + rng() * 4000),
    });
  }
  // anchor the latest close to the live price
  if (coin) bars[bars.length - 1].close = coin.price;
  return bars;
}

export function mockIndicators(id: string, limit: number): Indicator[] {
  const bars = mockOHLCV(id, "1M").slice(-limit);
  return bars.map((b, i) => {
    const rng = seeded(hash(id) + i);
    const sma20 = b.close * (0.98 + rng() * 0.04);
    return {
      time: b.time,
      rsi14: 30 + rng() * 45,
      macd: (b.close - sma20) * 0.4,
      signal: (b.close - sma20) * 0.3,
      sma20,
      ema50: b.close * (0.96 + rng() * 0.05),
      bbUpper: b.close * 1.04,
      bbLower: b.close * 0.96,
    };
  });
}

const HEADLINES: Array<{ t: string; s: string; src: string; sent: number; coins: string[] }> = [
  { t: "Bitcoin reclaims $67K as spot ETF inflows hit a three-month high", s: "Institutional demand accelerates with $1.2B of net inflows recorded across major funds this week.", src: "CoinDesk", sent: 0.62, coins: ["bitcoin"] },
  { t: "Ethereum devs lock in next upgrade scope, gas fees expected to fall", s: "The proposed changes target calldata costs and could materially reduce L2 settlement expenses.", src: "The Block", sent: 0.41, coins: ["ethereum"] },
  { t: "Solana network sees record DEX volume amid memecoin frenzy", s: "On-chain activity surged 38% week-over-week, though validators warn about congestion risk.", src: "Decrypt", sent: 0.18, coins: ["solana"] },
  { t: "Regulators signal tougher stance on stablecoin reserves", s: "A draft framework would require monthly attestations and full cash-equivalent backing.", src: "Reuters", sent: -0.34, coins: ["tether"] },
  { t: "XRP slides as legal overhang returns to the spotlight", s: "Renewed uncertainty pressures the token after an appeal filing reopens old questions.", src: "CoinTelegraph", sent: -0.45, coins: ["ripple"] },
  { t: "Chainlink expands cross-chain standard to five new enterprise partners", s: "CCIP adoption widens as traditional finance pilots tokenized asset settlement.", src: "The Defiant", sent: 0.55, coins: ["chainlink"] },
  { t: "Market wrap: altcoins outperform as risk appetite returns", s: "Mid-cap tokens led gains while majors consolidated near local highs.", src: "CoinDesk", sent: 0.27, coins: ["avalanche-2", "polkadot", "cosmos"] },
  { t: "Dogecoin spikes on renewed payments-integration speculation", s: "Volume doubled within hours, though analysts urge caution on unconfirmed reports.", src: "Decrypt", sent: 0.12, coins: ["dogecoin"] },
  { t: "Analysts flag overheated funding rates across perpetual futures", s: "Elevated leverage raises the odds of a sharp deleveraging event, desks warn.", src: "Bloomberg", sent: -0.28, coins: ["bitcoin", "ethereum"] },
  { t: "Layer-2 TVL hits new all-time high as fees compress", s: "Rollups now custody record value as users migrate from mainnet.", src: "The Block", sent: 0.48, coins: ["ethereum", "polygon"] },
];

export function mockNews(limit: number, coinId?: string): NewsArticle[] {
  const now = Date.now();
  const list = HEADLINES.map((h, i) => ({
    id: `news-${i}`,
    title: h.t,
    url: "https://example.com/article/" + i,
    source: h.src,
    publishedAt: new Date(now - i * 37 * 60 * 1000).toISOString(),
    summary: h.s,
    sentiment: h.sent,
    coins: h.coins,
    imageUrl: undefined,
  }));
  const filtered = coinId ? list.filter((n) => n.coins.includes(coinId)) : list;
  return filtered.slice(0, limit);
}
