import os
import time
import requests
from datetime import datetime, timezone
from typing import Any
from app.ingest.base import BaseSource

COINGECKO_BASE = "https://api.coingecko.com/api/v3"
PRO_BASE       = "https://pro-api.coingecko.com/api/v3"


class CoinGeckoSource(BaseSource):
    def __init__(self) -> None:
        self.api_key = os.getenv("COINGECKO_API_KEY", "")
        self.base    = PRO_BASE if self.api_key else COINGECKO_BASE
        self.session = requests.Session()
        if self.api_key:
            self.session.headers["x-cg-pro-api-key"] = self.api_key

    # ── Public methods ────────────────────────────────────────────────────────

    def fetch_current(self) -> list[dict[str, Any]]:
        """Fetch current price snapshot for all tracked coins."""
        ids = ",".join(self.get_tracked_coins())
        resp = self._get("/coins/markets", {
            "vs_currency": "usd",
            "ids": ids,
            "order": "market_cap_desc",
            "per_page": 250,
            "price_change_percentage": "24h",
        })
        now = datetime.now(timezone.utc)
        return [
            {
                "coinId":    r["id"],
                "symbol":    r["symbol"].upper(),
                "name":      r["name"],
                "image":     r.get("image"),
                "rank":      r.get("market_cap_rank"),
                "time":      now,
                "price":     r.get("current_price") or 0,
                "change24h": r.get("price_change_percentage_24h") or 0,
                "volume24h": r.get("total_volume") or 0,
                "marketCap": r.get("market_cap") or 0,
            }
            for r in resp
        ]

    def fetch_ohlcv(self, coin_id: str, days: int = 1) -> list[dict[str, Any]]:
        """Fetch OHLCV candles for a single coin."""
        resp = self._get(f"/coins/{coin_id}/ohlc", {
            "vs_currency": "usd",
            "days": days,
        })
        # CoinGecko returns [[ts_ms, open, high, low, close], ...]
        return [
            {
                "coinId": coin_id,
                "time":   datetime.fromtimestamp(row[0] / 1000, tz=timezone.utc),
                "open":   row[1],
                "high":   row[2],
                "low":    row[3],
                "close":  row[4],
                "volume": 0,  # not in OHLC endpoint; enrich separately if needed
            }
            for row in resp
        ]

    def fetch_coin_list(self) -> list[dict[str, str]]:
        return self._get("/coins/list", {})

    # ── Internal ──────────────────────────────────────────────────────────────

    def _get(self, path: str, params: dict) -> Any:
        url = self.base + path
        for attempt in range(3):
            try:
                r = self.session.get(url, params=params, timeout=10)
                if r.status_code == 429:
                    time.sleep(2 ** attempt)
                    continue
                r.raise_for_status()
                return r.json()
            except requests.RequestException as exc:
                if attempt == 2:
                    raise
                time.sleep(1)
        return []