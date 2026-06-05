import os
import feedparser
import requests
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any

COIN_KEYWORDS: dict[str, list[str]] = {
    "bitcoin":      ["bitcoin", "btc"],
    "ethereum":     ["ethereum", "eth"],
    "solana":       ["solana", "sol"],
    "binancecoin":  ["binance", "bnb"],
    "ripple":       ["ripple", "xrp"],
    "cardano":      ["cardano", "ada"],
    "dogecoin":     ["dogecoin", "doge"],
}

RSS_FEEDS = [
    "https://cointelegraph.com/rss",
    "https://decrypt.co/feed",
    "https://bitcoinmagazine.com/.rss/full/",
]


def _parse_date(entry: Any) -> datetime:
    try:
        return parsedate_to_datetime(entry.get("published", ""))
    except Exception:
        return datetime.now(timezone.utc)


def _detect_coins(text: str) -> list[str]:
    lower = text.lower()
    return [
        coin_id
        for coin_id, keywords in COIN_KEYWORDS.items()
        if any(kw in lower for kw in keywords)
    ]


def fetch_articles() -> list[dict[str, Any]]:
    """Fetch articles from all configured RSS feeds."""
    articles = []
    for url in RSS_FEEDS:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:20]:
                title   = entry.get("title", "")
                summary = entry.get("summary", "")
                articles.append({
                    "title":       title,
                    "url":         entry.get("link", ""),
                    "source":      feed.feed.get("title", url),
                    "publishedAt": _parse_date(entry),
                    "summary":     summary[:500] if summary else None,
                    "coins":       _detect_coins(title + " " + summary),
                    "imageUrl":    None,
                })
        except Exception as exc:
            print(f"[NewsIngest] Failed to fetch {url}: {exc}")

    return articles