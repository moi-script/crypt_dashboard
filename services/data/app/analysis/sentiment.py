"""
Sentiment scoring for news articles.
Uses VADER (vaderSentiment) if available, falls back to a keyword scorer.
Score range: -1.0 (bearish) to +1.0 (bullish).
"""

from __future__ import annotations
from typing import Optional

# ── VADER (preferred) ─────────────────────────────────────────────────────────

try:
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    _vader = SentimentIntensityAnalyzer()
    _HAS_VADER = True
except ImportError:
    _HAS_VADER = False

# ── Keyword fallback ──────────────────────────────────────────────────────────

_BULLISH = [
    "surge", "rally", "bull", "soar", "gain", "up", "rise", "high",
    "breakout", "adoption", "partnership", "launch", "upgrade", "bullish",
    "buy", "accumulate", "recovery", "rebound", "moon",
]

_BEARISH = [
    "crash", "drop", "bear", "fall", "down", "loss", "low", "hack",
    "breach", "fraud", "ban", "regulation", "sell", "dump", "collapse",
    "warning", "risk", "decline", "plunge", "bearish",
]


def _keyword_score(text: str) -> float:
    lower = text.lower()
    bull_hits = sum(1 for w in _BULLISH if w in lower)
    bear_hits = sum(1 for w in _BEARISH if w in lower)
    total = bull_hits + bear_hits
    if total == 0:
        return 0.0
    return round((bull_hits - bear_hits) / total, 4)


# ── Public API ────────────────────────────────────────────────────────────────

def score(text: str) -> float:
    """Return a sentiment score in [-1, 1]."""
    if not text or not text.strip():
        return 0.0
    if _HAS_VADER:
        vs = _vader.polarity_scores(text)
        return round(vs["compound"], 4)
    return _keyword_score(text)


def score_article(title: str, summary: Optional[str] = None) -> float:
    combined = title + (" " + summary if summary else "")
    return score(combined)