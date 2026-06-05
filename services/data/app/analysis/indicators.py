"""
Pure-numpy technical indicator calculations.
All functions accept a 1-D numpy array of closes (oldest→newest)
and return a scalar or tuple of scalars for the latest bar.
"""

from __future__ import annotations
import numpy as np
from dataclasses import dataclass
from typing import Optional


@dataclass
class IndicatorSnapshot:
    rsi14:    Optional[float]
    macd:     Optional[float]
    signal:   Optional[float]
    sma20:    Optional[float]
    ema50:    Optional[float]
    bb_upper: Optional[float]
    bb_lower: Optional[float]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ema(series: np.ndarray, period: int) -> np.ndarray:
    alpha = 2 / (period + 1)
    result = np.empty_like(series)
    result[0] = series[0]
    for i in range(1, len(series)):
        result[i] = alpha * series[i] + (1 - alpha) * result[i - 1]
    return result


# ── Individual indicators ─────────────────────────────────────────────────────

def rsi(closes: np.ndarray, period: int = 14) -> Optional[float]:
    if len(closes) < period + 1:
        return None
    deltas = np.diff(closes)
    gains  = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])
    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i])  / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return float(100 - (100 / (1 + rs)))


def macd(closes: np.ndarray, fast=12, slow=26, signal_period=9
         ) -> tuple[Optional[float], Optional[float]]:
    if len(closes) < slow + signal_period:
        return None, None
    ema_fast   = _ema(closes, fast)
    ema_slow   = _ema(closes, slow)
    macd_line  = ema_fast - ema_slow
    signal_line = _ema(macd_line, signal_period)
    return float(macd_line[-1]), float(signal_line[-1])


def sma(closes: np.ndarray, period: int) -> Optional[float]:
    if len(closes) < period:
        return None
    return float(np.mean(closes[-period:]))


def ema(closes: np.ndarray, period: int) -> Optional[float]:
    if len(closes) < period:
        return None
    return float(_ema(closes, period)[-1])


def bollinger_bands(closes: np.ndarray, period: int = 20, num_std: float = 2.0
                    ) -> tuple[Optional[float], Optional[float]]:
    if len(closes) < period:
        return None, None
    window = closes[-period:]
    mid    = np.mean(window)
    std    = np.std(window, ddof=1)
    return float(mid + num_std * std), float(mid - num_std * std)


# ── Composite snapshot ────────────────────────────────────────────────────────

def compute_snapshot(closes: list[float]) -> IndicatorSnapshot:
    arr = np.array(closes, dtype=float)
    bb_upper, bb_lower = bollinger_bands(arr)
    macd_val, sig_val  = macd(arr)
    return IndicatorSnapshot(
        rsi14=    rsi(arr),
        macd=     macd_val,
        signal=   sig_val,
        sma20=    sma(arr, 20),
        ema50=    ema(arr, 50),
        bb_upper= bb_upper,
        bb_lower= bb_lower,
    )