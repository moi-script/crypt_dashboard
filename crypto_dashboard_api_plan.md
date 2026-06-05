# Crypto Dashboard — API Service: Codebase Overview & Architecture Plan

> **Source:** `C:\crypto_dashboard\my-app\services\api\src`
> **Scraped:** 2026-06-06 | **Total files reviewed:** 21

---

## What Is This?

This is the **backend API service** of a full-stack cryptocurrency dashboard application. It is a **Node.js/Express REST API** written in **TypeScript** that powers features like:

- Browsing live coin prices and market data
- Viewing OHLCV (candlestick) charts and technical indicators
- Reading crypto news articles with sentiment scores
- Managing a personal portfolio of coin holdings
- Setting price alerts (above/below/percent-change triggers)
- User authentication with JWT tokens and session management

The API sits in a microservices-style monorepo (`my-app/services/api`) and talks to two data stores: **MongoDB** (primary data) and **Redis** (caching + token blocklist).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| Database | MongoDB via Mongoose ODM |
| Cache / Session | Redis (`redis` client) |
| Auth | JSON Web Tokens (JWT, `jsonwebtoken`) |
| Password hashing | bcrypt (12 salt rounds) |
| Validation | Zod schemas |
| Rate limiting | `express-rate-limit` |

---

## Directory Structure

```
src/
├── config/
│   ├── db.ts              # MongoDB connection
│   └── redis.ts           # Redis client + connect helper
│
├── middleware/
│   ├── auth.ts            # JWT Bearer token verification
│   ├── errorHandler.ts    # AppError class + global error handler
│   ├── rateLimit.ts       # IP-based rate limiters
│   └── validate.ts        # Zod schemas + validate() middleware factory
│
├── models/
│   ├── user.model.ts      # User document + password helpers
│   ├── coin.model.ts      # Coin, Indicator documents + CoinModel query class
│   ├── alert.model.ts     # Price alert document
│   ├── news.model.ts      # News article document
│   ├── portfolio.service.ts  # Portfolio + Holding (inline schema)
│   └── schemes/
│       └── ohlcv.schema.ts   # MongoDB time-series collection for candlestick data
│
├── controllers/
│   ├── auth.controller.ts
│   ├── coin.controller.ts
│   ├── alert.controller.ts
│   ├── news.controller.ts
│   └── portfolio.controller.ts
│
├── services/
│   ├── auth.service.ts
│   ├── coin.service.ts
│   ├── alert.service.ts
│   ├── news.service.ts
│   └── portfolio.service.ts
│
└── routes/
    ├── index.ts           # Master router — mounts all sub-routers
    ├── auth.routes.ts
    ├── coin.routes.ts
    ├── alert.routes.ts
    ├── news.routes.ts
    └── portfolio.routes.ts
```

---

## Config Layer (`/config`)

### `db.ts`
Single-line MongoDB connector. Reads `MONGO_URL` from the environment and calls `mongoose.connect()`. Designed to be called once at app startup.

### `redis.ts`
Creates a Redis client pointing to `REDIS_URL` (defaults to `redis://localhost:6379`). Exports both the client (`redis`) and a `connectRedis()` async function that connects and logs confirmation. The client is used across services for caching and token revocation.

---

## Middleware Layer (`/middleware`)

### `auth.ts` — JWT Guard
Reads the `Authorization: Bearer <token>` header, verifies it against `JWT_SECRET`, and injects `req.userId` (the token's `sub` claim) for downstream handlers. Passes `AppError(401)` on failure — never throws directly. Consumed by all protected routes.

### `errorHandler.ts` — Centralized Error Handling
Defines `AppError`, a typed error class carrying an HTTP status code alongside the message. The exported `errorHandler` middleware intercepts errors, returns structured `{ error: message }` JSON for known `AppError`s, and falls back to `500 Internal Server Error` for anything else.

### `rateLimit.ts` — Request Throttling
Two limiters (both 15-minute windows per IP):
- `apiLimiter` — 100 requests/window; applied generally
- `authLimiter` — 10 requests/window; applied strictly to auth endpoints to slow brute-force attempts

### `validate.ts` — Input Validation
A `validate(schema, source)` factory returns an Express middleware that calls `schema.safeParse()` on the chosen source (`body`, `query`, or `params`). On failure it builds a human-readable message from Zod issues and passes `AppError(400)`. On success it replaces the source with the parsed/coerced value so downstream handlers get clean typed data.

**All Zod schemas are defined here** and imported by controllers:

| Schema | Validates |
|---|---|
| `RegisterBody` | email (valid format) + password (8–72 chars) |
| `LoginBody` | email + password (non-empty) |
| `RefreshBody` | refreshToken (non-empty string) |
| `CoinParams` | route `:id` (non-empty) |
| `OHLCVQuery` | `range` enum: `1D \| 1W \| 1M \| 1Y`, default `1D` |
| `IndicatorsQuery` | `limit` coerced int 1–500, default 100 |
| `NewsQuery` | `limit` coerced int 1–100, default 20 |
| `NewsByCoinParams` | route `:coinId` |
| `CreateAlertBody` | coinId + condition enum + finite threshold number |
| `AlertParams` | route `:id` |
| `ToggleAlertBody` | `active` boolean |
| `UpsertHoldingBody` | coinId + positive quantity + non-negative avgCost |
| `PortfolioCoinParams` | route `:coinId` |

---

## Data Models (`/models`)

### `user.model.ts`
Stores registered users. Fields: `email` (unique, lowercased), `passwordHash`. Exports `hashPassword` (bcrypt, 12 rounds) and `verifyPassword` helpers. Timestamps added by Mongoose.

### `coin.model.ts`
Two Mongoose models + one query class:

- **`CoinDoc`** — stores current market snapshot per coin: price, 24h change, volume, market cap, rank, image. Updated by a separate data worker (not in this codebase).
- **`IndicatorDoc`** — stores computed technical indicators per coin per timestamp: RSI-14, MACD, Signal line, SMA-20, EMA-50, Bollinger Bands (upper/lower).
- **`CoinModel`** (class) — query layer used by `CoinService`. Includes an aggregation pipeline in `findOHLCV()` that bins raw OHLCV ticks into time buckets (5-min / 1-hour / 4-hour / 1-day) depending on the requested range.

### `ohlcv.schema.ts` (under `schemes/`)
A MongoDB **time-series collection** (`timeseries: { timeField: 'time', metaField: 'coinId' }`). Stores raw OHLCV ticks (open, high, low, close, volume) per coin per timestamp. Optimized for time-range queries. The `CoinModel.findOHLCV()` aggregation uses `$dateTrunc` to bin these ticks before returning them.

### `alert.model.ts`
Price alerts per user. Fields: `userId`, `coinId`, `condition` (`above | below | pct_change`), `threshold`, `triggered`, `active`, optional `triggeredAt`. Indexed on `userId` and `coinId`. The `AlertService.markTriggered()` method is designed to be called by a Redis pub/sub data worker when a condition fires.

### `news.model.ts`
News articles. Fields: `title`, `url` (unique), `source`, `publishedAt`, `summary`, `sentiment` (float −1 to 1), `coins` (array of coinIds mentioned), optional `imageUrl`. Indexed for efficient latest-first and per-coin queries.

### Portfolio (inline in `portfolio.service.ts`)
A `Portfolio` document with a `holdings` array. Each holding stores `coinId`, `quantity`, `avgCost` (USD cost basis), `addedAt`. Schema and `PortfolioDoc` model are defined inline within the service file — intentionally kept small.

---

## Service Layer (`/services`)

Services contain all business logic and data access. Controllers call services; services never call controllers.

### `auth.service.ts`
Full auth lifecycle:
- **`register`** — validates uniqueness, hashes password with bcrypt, creates user, issues access + refresh tokens.
- **`login`** — timing-safe comparison using a dummy hash when the user isn't found (prevents user enumeration via timing).
- **`refresh`** — checks Redis blocklist, verifies JWT, rotates the refresh token (revokes old, issues new), returns new pair.
- **`logout`** — adds the token to Redis blocklist with a 7-day TTL.
- **`me`** — fetches user profile minus password hash.

Tokens: access token TTL = 15 minutes, refresh token TTL = 7 days.

### `coin.service.ts`
Wraps `CoinModel` with Redis caching:
- `getAll()` — cache key `coins:all`, 30-second TTL.
- `getOne(coinId)` — cache key `coins:{coinId}`, 30-second TTL. Throws 404 if not found.
- `getOHLCV(coinId, range)` — delegates directly to `CoinModel.findOHLCV()` (no cache; aggregation results vary by time).
- `getIndicators(coinId, limit)` — cache key `coins:{coinId}:indicators:{limit}`, 60-second TTL.

### `alert.service.ts`
CRUD for user alerts:
- `getForUser` — returns only active alerts, newest first.
- `create` — inserts and returns the new alert object.
- `delete` — scoped to `userId` to prevent cross-user deletion; throws 404 if not found.
- `toggle` — updates `active` flag, returns updated document.
- `markTriggered` — called by data workers; marks alert as triggered with a timestamp.

### `news.service.ts`
- `getLatest(limit, coinId?)` — cached for 120 seconds. Optional `coinId` filter reuses the same method for both "all news" and "news by coin" endpoints.
- `getForCoin(coinId, limit)` — delegates to `getLatest` with the filter.

### `portfolio.service.ts`
- `get(userId)` — cached 60 seconds. Returns `{ userId, holdings: [] }` if no portfolio exists yet.
- `upsertHolding` — two-step upsert: first tries to update an existing holding by coinId, then pushes a new one if not found. Always invalidates cache.
- `removeHolding` — uses `$pull` to remove a holding by coinId. Throws 404 if no portfolio exists.

---

## Controller Layer (`/controllers`)

Controllers are thin wrappers. Each method catches errors and passes them to `next(err)` for the global error handler. Validation middleware is composed inline using the `validate()` factory.

The array-of-handlers pattern (e.g., `create = [validate(CreateAlertBody), async handler]`) lets route files spread them directly: `router.post('/', ...ctrl.create)`.

---

## Routes (`/routes`)

### Master Router (`index.ts`)

```
GET  /health           → health check
/auth      → auth.routes.ts
/coins     → coin.routes.ts
/alerts    → alert.routes.ts
/news      → news.routes.ts
/portfolio → portfolio.routes.ts
```

### Auth Routes (`/auth`) — rate-limited (10 req/15 min)
```
POST /register    → public
POST /login       → public
POST /refresh     → public
POST /logout      → protected (JWT required)
GET  /me          → protected (JWT required)
```

### Coin Routes (`/coins`) — public
```
GET /               → list all coins
GET /:id            → single coin detail
GET /:id/ohlcv      → candlestick data (?range=1D|1W|1M|1Y)
GET /:id/indicators → technical indicators (?limit=100)
```

### Alert Routes (`/alerts`) — all protected
```
GET    /        → list user's active alerts
POST   /        → create alert
DELETE /:id     → delete alert
PATCH  /:id     → toggle active status
```

### News Routes (`/news`) — public
```
GET /              → latest news (?limit=20)
GET /coin/:coinId  → news by coin (?limit=20)
```

### Portfolio Routes (`/portfolio`) — all protected
```
GET    /                  → get portfolio with holdings
PUT    /holdings           → upsert a holding (add or update)
DELETE /holdings/:coinId  → remove a holding
```

---

## Security Design

| Concern | Approach |
|---|---|
| Authentication | JWT Bearer tokens; access tokens short-lived (15 min) |
| Token rotation | Refresh tokens are rotated on every use (old token revoked in Redis) |
| Token revocation | Redis blocklist with TTL matching refresh token lifespan |
| Password storage | bcrypt with 12 salt rounds |
| Timing attacks | Dummy hash comparison when user not found (prevents user enumeration) |
| Brute force | Rate limiter on auth routes (10 req / 15 min per IP) |
| Input validation | Zod on all request bodies, query strings, and route params |
| Error leakage | `AppError` returns only intentional messages; unhandled errors return generic 500 |
| Authorization | User-scoped queries (`userId` filter on all alert/portfolio operations) |

---

## Caching Strategy (Redis)

| Cache Key | TTL | Notes |
|---|---|---|
| `coins:all` | 30 sec | All coins list |
| `coins:{id}` | 30 sec | Single coin detail |
| `coins:{id}:indicators:{limit}` | 60 sec | Technical indicators |
| `news:{coinId\|all}:{limit}` | 120 sec | News articles |
| `portfolio:{userId}` | 60 sec | User portfolio |
| `blocklist:{token}` | 7 days | Revoked JWT tokens |

OHLCV data is **not cached** — the aggregation pipeline bins data dynamically by time range and the results change continuously.

---

## Data Flow Summary

```
Client Request
     │
     ▼
Rate Limiter (rateLimit.ts)
     │
     ▼
Auth Middleware (auth.ts)  ← only on protected routes
     │
     ▼
Validation Middleware (validate.ts)
     │
     ▼
Controller  →  Service  →  Model / Redis
     │
     ▼
Response JSON
     │  (on error)
     ▼
errorHandler.ts  →  { error: "message" }
```

---

## What's Not In This Codebase (Implied Dependencies)

- **Data Worker** — a separate service that fetches live coin prices from an exchange/API (CoinGecko, Binance, etc.) and writes to MongoDB. It also likely publishes to Redis pub/sub to trigger `AlertService.markTriggered()`.
- **App Entry Point** (`index.ts` / `app.ts`) — the Express app setup, middleware registration, and startup sequence calling `connectDB()` and `connectRedis()`.
- **Environment Variables** — `MONGO_URL`, `REDIS_URL`, `JWT_SECRET` must be provided at runtime.
- **Frontend** — the `my-app` monorepo likely includes a React/Next.js frontend consuming this API.

---

## Potential Improvements / Open Questions

1. **OHLCV caching** — consider short-lived caching (e.g., 10 sec) on the OHLCV aggregation to reduce database load during high traffic.
2. **Alert deduplication** — no check preventing a user from creating duplicate alerts for the same coin/condition/threshold.
3. **Portfolio cache invalidation** — `getForUser` re-caches on read; upsert/remove correctly invalidates. Solid design.
4. **Refresh token family tracking** — current implementation revokes individual tokens. For stronger security, consider refresh token families to detect theft (revoke entire family if a used token is presented again).
5. **`AlertService.getForUser`** — currently filters `active: true`, so deleted/inactive alerts are invisible. Intentional but worth documenting for frontend devs.
6. **Portfolio schema location** — the `IPortfolio` schema living in `portfolio.service.ts` works but breaks the pattern. Extracting it to `portfolio.model.ts` would improve consistency.
