data/
├── app/
│   ├── api/
│   │   ├── router.py           # mounts all sub-routers
│   │   ├── coins.py            # FastAPI router for coins
│   │   └── health.py
│   │
│   ├── ingest/
│   │   ├── base.py             # Source adapter interface
│   │   ├── coingecko.py        # CoinGecko adapter
│   │   └── news.py             # News/RSS adapter
│   │
│   ├── analysis/
│   │   ├── indicators.py       # RSI, MACD, BB, EMA using pandas-ta
│   │   ├── signals.py          # rule-based scoring
│   │   └── sentiment.py        # VADER / transformer sentiment
│   │
│   ├── workers/
│   │   ├── celery_app.py       # Celery + beat scheduler
│   │   ├── price_poll.py       # every 30s: fetch + store + publish
│   │   ├── indicator_update.py # per new OHLCV bucket
│   │   ├── news_fetch.py       # every 5 min
│   │   └── alert_eval.py       # evaluate alert conditions
│   │
│   ├── db/
│   │   ├── session.py          # SQLAlchemy async session
│   │   ├── models.py           # ORM models
│   │   └── migrations/         # Alembic
│   │
│   └── main.py                 # FastAPI app entry
│
├── pyproject.toml
└── Dockerfile