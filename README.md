# Profy.ai

An autonomous AI crypto trading terminal — live market data, a multi-framework analysis agent, paper trading engine with full position lifecycle, and a real-time dashboard built as a monorepo with Next.js + Express + Python.

---

## Tech Stack

### Frontend
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

### Backend
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)

### Database & Cache
![MongoDB](https://img.shields.io/badge/MongoDB_Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)

### AI & Data
![OpenRouter](https://img.shields.io/badge/OpenRouter-6B46C1?style=for-the-badge&logo=openai&logoColor=white)
![DeepSeek](https://img.shields.io/badge/DeepSeek-0066FF?style=for-the-badge&logo=deepmind&logoColor=white)
![HuggingFace](https://img.shields.io/badge/HuggingFace-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)
![Celery](https://img.shields.io/badge/Celery-37814A?style=for-the-badge&logo=celery&logoColor=white)

### Infrastructure
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![MongoDB Atlas](https://img.shields.io/badge/Atlas_CLI-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)

---

## Starting from Scratch (Every Session)

Follow these steps in order every time you open the project.

### Step 1 — Open Docker Desktop
Open **Docker Desktop** from the Start menu and wait until it says **"Engine running"** in the bottom left.

### Step 2 — Start Atlas + API (Backend)
Open a terminal in the API folder and run the startup script:

```powershell
cd C:\crypto_dashboard\my-app\services\api
.\start-dev.ps1
```

This script automatically:
- Starts the Atlas local MongoDB deployment (`local8499`)
- Detects the new port Docker assigned
- Updates `MONGO_URL` in `.env.local` with the correct `host.docker.internal` address
- Restarts the Docker API container with the new URL

You will see:
```
Starting Atlas local deployment 'local8499'...
Deployment 'local8499' started
Atlas connection string (Docker): mongodb://host.docker.internal:XXXXX/?directConnection=true
Root .env.local updated.
Restarting Docker containers...
✔ Container my-app-redis-1  Healthy
✔ Container my-app-api-1    Recreated
Done. API container restarted with new MongoDB URL.
```

### Step 3 — Start the Frontend
Open a **second terminal** and run:

```powershell
cd C:\crypto_dashboard\my-app
npm run dev
```

Frontend runs on [http://localhost:3000](http://localhost:3000)

### Step 4 — Open the App
Go to [http://localhost:3000](http://localhost:3000) and log in.

---

## Stopping Everything

When you're done for the day:

**1. Stop the frontend** — press `Ctrl + C` in the terminal running `npm run dev`

**2. Stop Docker containers:**
```powershell
cd C:\crypto_dashboard\my-app
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

**3. Stop Atlas** *(optional — closes automatically when Docker Desktop shuts down):*
```powershell
atlas local stop local8499
```

**4. Close Docker Desktop**

> Logging out of the web app does **not** stop Docker. The API and Redis containers keep running in the background until you run `docker compose down` or shut down Docker Desktop.

---

## What's Running Where

| Service | Where | Port |
|---|---|---|
| Frontend (Next.js) | Local `npm run dev` | 3000 |
| API (Express) | Docker `my-app-api-1` | 4000 |
| Redis | Docker `my-app-redis-1` | 6379 |
| Data pipeline | Docker `my-app-data-1` | 8001 |
| MongoDB | Atlas CLI local (`local8499`) | dynamic |

---

## Hot Reload (Code Changes)

The API container has **hot reload enabled** — any change to a `.ts` file in `services/api/src/` is detected by nodemon and the server restarts automatically inside Docker. **No rebuild needed.**

You only need to rebuild (`--build`) if you:
- Add or remove a package in `package.json`
- Change `Dockerfile.dev`

To rebuild:
```powershell
cd C:\crypto_dashboard\my-app
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.local up -d --build api
```

To watch live API logs:
```powershell
docker logs -f my-app-api-1
```

---

## Screenshots

### Dashboard — Agent Runs & Intelligence Scanner
![Dashboard with agent runs and live intelligence scanner](./seed-07-dashboard-top.png)

> Five seeded agent runs with `propose trade` / `no action` badges, wallet balances (USDC / BTC / ETH), and the Intelligence Scanner surfacing live SHORT windows on AAVE, AVAX, APT, ARB, SUI.

---

### Agent Run — Expanded Reasoning
![Expanded agent run showing BNB Wyckoff analysis](./seed-09-run-expanded.png)

> Expanded run card for BNB showing the agent's full Wyckoff Phase D LPS reasoning, confidence score, and intent breakdown.

---

### Agent Tab — Run Stats
![Agent runs tab with stats](./seed-14-agent-tab.png)

> 10 total runs · 6 done · 4 in last 24 h · 3 blocked · 1 pending approval. Intent breakdown bar shows 8 propose-trade vs 2 no-action decisions.

---

### Pending Approval Card
![BTC pending approval card with annotated chart](./seed-16-approval-card.png)

> Full BTC approval card: TradingView candlestick chart annotated with TP1 / TP2 / Entry Hi–Lo / SL levels, live price near zone, R:R 1:1.1 at 74 % confidence. One-click Approve / Reject with fee-adjusted net R:R shown.

---

### Positions Tab — Statistics
![Positions tab showing PnL stats and alpha vs BTC](./seed-17-positions-tab.png)

> Total PnL **+$73.50** · Win rate 50 % · Portfolio heat $49 at risk. **vs BTC Hold since 6/14**: Agent +0.7 % vs BTC −3.5 % = **+4.2 % alpha**.

---

### Open Position — ETH Long with Live Chart
![ETH open position with live TradingView chart](./seed-19-positions-list.png)

> Live ETH long: P&L +$8.60 (+0.12 %), annotated entry-zone chart, partial-exit buttons (25 % / 50 % / 75 %), Move SL → BE, and trailing-stop controls.

---

### Closed Position — SOL TP Hit
![SOL closed position with TP hit badge and +$37.30 PnL](./seed-23-sol-closed.png)

> SOL TP Hit: entry $57.00 → exit $72.00, R:R 1:1.7, **+$37.30** realised PnL in green. Trade journal at bottom.

---

### Signals Tab — Yield Opportunities
![Signals tab showing DeFi yield anomaly cards](./seed-24-signals-tab.png)

> Two seeded yield-anomaly cards: ETH/stETH Balancer (6.1 % APY spike, score 69) and USDC/USDT Curve Arbitrum (8.4 % APY spike, score 78) with protocol tags and one-click Deploy.

---

### Paper Wallet — Equity Curve
![Paper wallet showing +64.35% portfolio growth](./seed-25-wallet.png)

> Paper wallet: **$8,217.58** portfolio value, **+64.35 %** total return, +$895.72 PnL. Clean equity curve from start date — no major drawdowns.

---

## Architecture

```
my-app/
├── app/                        # Next.js 14 App Router (frontend)
│   ├── agent/                  # AI Agent chat + trading dashboard
│   ├── dashboard/              # Main market dashboard
│   ├── portfolio/              # Manual holdings tracker
│   ├── alerts/                 # Price alerts
│   ├── coins/[id]/             # Coin detail pages
│   └── news/                   # News feed
│
├── src/
│   ├── components/             # Reusable UI (charts, cards, modals)
│   ├── views/                  # Page-level view components
│   ├── controllers/            # React hooks (useAuth, useAlerts, etc.)
│   ├── services/               # Frontend API clients
│   └── models/                 # Frontend type models
│
└── services/
    ├── api/                    # Express + TypeScript backend
    │   └── src/
    │       ├── agents/         # Autonomous agent system
    │       │   ├── loop/       # Agent loop, position monitor, scheduler
    │       │   ├── coinAnalysis/  # Multi-framework analysis runner
    │       │   ├── memory/     # Vector-embedded agent memory
    │       │   ├── policy/     # Strategy engines + LLM prompts
    │       │   ├── skills/     # Technical analysis primitives
    │       │   └── tools/      # Read / act / chart tools
    │       ├── execution/      # Paper & live executors
    │       ├── risk/           # Risk engine, rules, config
    │       ├── routes/         # REST API routes
    │       ├── services/       # DB + external service layers
    │       ├── models/         # Mongoose schemas
    │       └── websocket/      # Socket.IO + Redis pub/sub
    │
    └── data/                   # Python data pipeline
        ├── app/workers/        # Celery tasks (OHLCV, order blocks, regime)
        └── Dockerfile
```

### Service map

```
Browser (Next.js :3000)
    │  REST + WebSocket
    ▼
Express API (:4000) ──► MongoDB Atlas (local8499 via Atlas CLI)
    │                        │
    ├── Agent Loop           └── Redis (:6379)
    │   (60 s sweep)              (pub/sub, cache)
    │
    └── Python Data Service (:8001)
        Celery Worker + Beat
        (OHLCV ingestion, order blocks, regime detection)
```

---

## Full Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Data fetching | TanStack React Query |
| Charts | Lightweight Charts (TradingView), Chart.js |
| Icons | Lucide React |
| Auth | JWT (access 15 min / refresh 7 d), stored in `localStorage` under `cd.access` / `cd.refresh` |

### Backend — API (`services/api`)
| Layer | Technology |
|---|---|
| Runtime | Node.js + Express |
| Language | TypeScript |
| Database | MongoDB Atlas (Mongoose) |
| Cache / Pub-Sub | Redis 7 |
| AI / LLM | OpenAI-compatible via OpenRouter (DeepSeek default) |
| Embeddings | `@huggingface/transformers` (local, `all-MiniLM-L6-v2`) |
| Auth | bcrypt + JWT (`jsonwebtoken`) |
| Real-time | Socket.IO + Redis subscriber |
| Rate limiting | `express-rate-limit` |
| Security | `helmet`, `hpp`, `xss-clean`, `cors` |
| Testing | Jest + `mongodb-memory-server` + Supertest |

### Backend — Data Pipeline (`services/data`)
| Layer | Technology |
|---|---|
| Runtime | Python 3.11 |
| Task queue | Celery + Redis broker |
| Scheduler | Celery Beat (persistent) |
| Data source | CoinGecko API (OHLCV, coin universe) |
| DeFi data | DeFiLlama (yield opportunities) |
| Storage | MongoDB Atlas |

### Infrastructure
| Component | Details |
|---|---|
| Containerisation | Docker Compose (redis, api, data, worker, beat) |
| Dev hot reload | nodemon + ts-node via volume mount |
| MongoDB | Atlas CLI local deployment (`local8499`) |
| Redis | `redis:7-alpine`, volume-persisted |

---

## Features

### Autonomous Agent Loop
- Runs every 60 s per user session; configurable via UI
- Fetches primitives (OHLCV, order blocks, regime, sentiment, memory) in parallel
- Routes through 6 trading frameworks simultaneously
- Supports `requireManualApproval` (pauses for human sign-off) or full auto-execute

### Multi-Framework Analysis
| Framework | What it detects |
|---|---|
| **SmartMoney** | Order blocks, BOS, CHOCH, fair-value gaps, liquidity voids |
| **Wyckoff** | Accumulation / distribution phases (Phase A–E, LPS, PSY, UTAD) |
| **ElliottWave** | 5-wave impulse + 3-wave correction identification |
| **Harmonic** | Gartley, Bat, Butterfly, Crab, Cypher XABCD patterns |
| **ChartSignal** | Multi-timeframe momentum confluence |
| **YieldHunter** | DeFi APY anomaly detection via DeFiLlama |

### Position Lifecycle
```
propose_trade → pending (limit order) → open → partial exit (TP1 50%)
                                              → partial exit (TP2 40%)
                                              → runner (10%, trailing stop)
                                              → closed (SL / TP / manual / time-stop)
```

- **Limit orders**: wait for zone fill; cancelled if `entryExpiresAt` passes
- **Flash-crash SL detection**: fetches 1H candle low/high to catch SLs crossed intra-bar
- **Trailing stops**: server-side high-water-mark updated each 60 s sweep
- **TP1 scale-out**: 50 % exit credits wallet via `$inc` (survives TP2 full close)
- **Direction-aware**: every position carries `bias: 'long' | 'short'` for correct SL/TP polarity

### Risk Engine
| Control | Default | Description |
|---|---|---|
| `riskPerTradePct` | 1.0 % | Risk per trade as % of portfolio |
| `maxPortfolioHeatPct` | 5.0 % | Total open-risk cap; blocks new entries |
| `maxConcurrentPositions` | 6 | Hard cap on concurrent positions |
| `maxRiskPerTradeUsd` | $150 | Absolute dollar risk cap per trade |
| `maxDrawdownPct` | 10 % | Equity-curve circuit breaker |
| `dailyLossLimitPct` | 2 % | Daily loss limit, resets at 22:00 UTC |
| `maxNewPositionsPerDay` | 3 | Entry cap per trading day |

### Agent Memory System
- Writes structured memories after each completed analysis
- Embeddings generated locally via HuggingFace `all-MiniLM-L6-v2` (baked into Docker image)
- Vector similarity search retrieves relevant past context per coin/session
- Reflection generator creates higher-level pattern summaries over time

### Intelligence Scanner
- Scans top coins continuously for trading windows
- Scores each coin across multiple signals (momentum, structure, volume, regime)
- Surfaces top SHORT / LONG opportunities sorted by composite score
- Filters by window duration (e.g. 180m, 240m, 360m windows)

### Chart Analysis Pipeline
- Two-tier pipeline: primitives → LLM interpretation
- Fetches OHLCV from CoinGecko (1D, 4H, 1H, 15m timeframes)
- Computes: RSI, MACD, Bollinger Bands, ATR, EMA stack, pivots, Fibonacci levels
- Detects: trend structure, order blocks, volume profile, Wyckoff phase, Elliott count
- Results stored in MongoDB and surfaced in the dashboard History tab

### Paper Wallet
- Simulated execution with realistic slippage model (base spread + size impact)
- 0.1 % taker fee on market fills, maker fee on limit fills
- Full trade history with realised PnL per fill
- Equity curve chart with vs-BTC-hold alpha comparison
- Reset button to restart from $10,000

### Real-time Feed
- Socket.IO server pushes price updates, agent status, and new run notifications
- Redis pub/sub decouples the agent loop from WebSocket delivery
- Ticker tape across all pages shows live prices for top 100 coins

---

## Agent Configuration (per user)

All settings are configurable from the **Config** tab in the UI:

```typescript
{
  enabled: boolean                 // master kill switch
  mode: 'paper' | 'cex' | 'onchain'
  loopIntervalMs: number           // default 60 000 ms
  strategies: {
    yieldHunter: boolean
    rebalance: boolean
    airdropWatch: boolean
    chartSignal: boolean
  }
  minSignalConfidence: number      // 0–100, default 55
  watchlist: string[]              // CoinGecko IDs
  maxTradeUsd: number
  requireManualApproval: boolean
  allowShorts: boolean
  riskPerTradePct: number          // 0.25–3.0
  maxPortfolioHeatPct: number
  maxConcurrentPositions: number
  maxRiskPerTradeUsd: number
  maxDrawdownPct: number
  dailyLossLimitPct: number
  maxNewPositionsPerDay: number
}
```

---

## API Reference

### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Login → returns access + refresh tokens |
| `POST` | `/api/auth/refresh` | Rotate access token |
| `GET` | `/api/auth/me` | Validate session |

### Agent
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/agent-runs` | List runs for session |
| `GET` | `/api/agent-runs/:id` | Single run detail |
| `POST` | `/api/agent-runs/:id/approve` | Approve a pending trade |
| `POST` | `/api/agent-runs/:id/reject` | Reject a pending trade |
| `GET` | `/api/agent-runs/config` | Get agent config |
| `PUT` | `/api/agent-runs/config` | Update agent config |

### Coin Analysis
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/coin-analysis/run` | Trigger on-demand analysis |
| `GET` | `/api/coin-analysis` | List analysis runs |
| `GET` | `/api/coin-analysis/:id` | Single run detail with approval card |

### Positions
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/positions` | List positions (open + closed) |
| `POST` | `/api/positions/:id/close` | Manual close |
| `POST` | `/api/positions/:id/partial-exit` | Partial exit (specify %) |
| `POST` | `/api/positions/:id/move-sl-be` | Move SL to breakeven |
| `POST` | `/api/positions/:id/set-trail` | Activate trailing stop |

### Paper Wallet
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/paper-wallet` | Get wallet balances + history |
| `POST` | `/api/paper-wallet/reset` | Reset to $10,000 |
| `GET` | `/api/paper-wallet/stats` | PnL stats, equity curve |

### Market Data
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/coins` | Top coins with live prices |
| `GET` | `/api/coins/:id` | Coin detail + OHLCV |
| `GET` | `/api/simple/price` | Live price lookup (CoinGecko proxy) |
| `GET` | `/api/news` | Latest crypto news |
| `GET` | `/api/intelligence` | Intelligence scan results |
| `GET` | `/api/order-blocks/:symbol` | Order blocks for symbol |

### Demo
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/demo/seed` | Seed demo data (5 runs, 4 positions, memories, opportunities) |

---

## Seed Demo Data

After registering and logging in, call the seed endpoint to populate the UI with example runs, positions, memories, and opportunities:

```javascript
// In browser DevTools console (after login)
fetch('/api/demo/seed', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('cd.access')
  }
}).then(r => r.json()).then(console.log)
```

---

## Testing

```bash
cd services/api
npm test

# Individual suites
npm test -- --testPathPattern=positionMonitor
npm test -- --testPathPattern=coinAnalysis
npm test -- --testPathPattern=memory
```

Tests use `mongodb-memory-server` — no Atlas connection required.

---

## Key Design Decisions

**Why paper trading only by default?**
`mode: 'paper'` is hardcoded as the default. CEX / on-chain execution requires explicit opt-in, separate API key configuration, and small caps enforced at the risk engine level.

**Why `$inc` for realised PnL?**
TP1 partial exits credit the wallet before the full position is closed. Using `$inc` means a subsequent TP2 or SL close does not overwrite the TP1 credit — both deltas accumulate correctly.

**Why local embeddings?**
`all-MiniLM-L6-v2` runs entirely on-device via `@huggingface/transformers`, baked into the Docker image. No embedding API cost, no data leaving the server.

**Why flash-crash SL detection?**
The position monitor sweeps every 60 s. A sharp wick can cross a SL and recover before the next sweep, leaving a losing position open. Fetching the 1H candle low/high on each sweep catches wicks that the live price comparison would miss.

**Why regime-adjusted framework thresholds?**
Framework win rates that are acceptable in trending markets become dangerous in ranging/choppy conditions. The policy engine softens disable thresholds in ranging regimes to avoid cutting frameworks during low-volatility periods that naturally compress win rates.

---

## Repository

[https://github.com/moi-script/crypt_dashboard](https://github.com/moi-script/crypt_dashboard)
