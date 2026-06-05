"""
Combines technical indicator snapshots into a simple directional signal.
Signal values: "buy" | "sell" | "hold"
Confidence: 0.0–1.0
"""

from __future__ import annotations
from dataclasses import dataclass
from app.analysis.indicators import IndicatorSnapshot


@dataclass
class Signal:
    direction:  str    # "buy" | "sell" | "hold"
    confidence: float  # 0–1
    reasons:    list[str]


def generate(snap: IndicatorSnapshot, price: float) -> Signal:
    bull_pts = 0
    bear_pts = 0
    reasons: list[str] = []

    # ── RSI ──────────────────────────────────────────────────────────────────
    if snap.rsi14 is not None:
        if snap.rsi14 < 30:
            bull_pts += 2
            reasons.append(f"RSI oversold ({snap.rsi14:.1f})")
        elif snap.rsi14 > 70:
            bear_pts += 2
            reasons.append(f"RSI overbought ({snap.rsi14:.1f})")

    # ── MACD crossover ────────────────────────────────────────────────────────
    if snap.macd is not None and snap.signal is not None:
        if snap.macd > snap.signal:
            bull_pts += 1
            reasons.append("MACD above signal")
        else:
            bear_pts += 1
            reasons.append("MACD below signal")

    # ── Price vs Bollinger Bands ──────────────────────────────────────────────
    if snap.bb_lower is not None and snap.bb_upper is not None:
        if price < snap.bb_lower:
            bull_pts += 1
            reasons.append("Price below lower BB")
        elif price > snap.bb_upper:
            bear_pts += 1
            reasons.append("Price above upper BB")

    # ── EMA trend ─────────────────────────────────────────────────────────────
    if snap.ema50 is not None:
        if price > snap.ema50:
            bull_pts += 1
            reasons.append("Price above EMA50")
        else:
            bear_pts += 1
            reasons.append("Price below EMA50")

    total = bull_pts + bear_pts
    if total == 0:
        return Signal("hold", 0.0, ["Insufficient data"])

    confidence = round(max(bull_pts, bear_pts) / total, 2)

    if bull_pts > bear_pts:
        return Signal("buy",  confidence, reasons)
    if bear_pts > bull_pts:
        return Signal("sell", confidence, reasons)
    return Signal("hold", 0.5, reasons)