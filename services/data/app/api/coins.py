from fastapi import APIRouter, HTTPException, Query
from app.db.models import Coin, OHLCV, Indicator
from app.analysis.indicators import compute_snapshot
from app.analysis.signals import generate

router = APIRouter(prefix="/coins", tags=["coins"])


@router.get("/")
async def list_coins():
    return await Coin.find_all().sort(Coin.rank).to_list()


@router.get("/{coin_id}")
async def get_coin(coin_id: str):
    coin = await Coin.find_one(Coin.coinId == coin_id)
    if not coin:
        raise HTTPException(404, f"Coin '{coin_id}' not found")
    return coin


@router.get("/{coin_id}/signal")
async def get_signal(coin_id: str):
    """Returns the latest computed signal for a coin."""
    coin = await Coin.find_one(Coin.coinId == coin_id)
    if not coin:
        raise HTTPException(404, f"Coin '{coin_id}' not found")

    candles = (
        await OHLCV.find(OHLCV.coinId == coin_id)
        .sort(-OHLCV.time)
        .limit(200)
        .to_list()
    )
    if len(candles) < 20:
        return {"direction": "hold", "confidence": 0, "reasons": ["Insufficient data"]}

    closes  = [c.close for c in reversed(candles)]
    snap    = compute_snapshot(closes)
    signal  = generate(snap, coin.price)
    return {
        "coinId":     coin_id,
        "direction":  signal.direction,
        "confidence": signal.confidence,
        "reasons":    signal.reasons,
        "indicators": snap.__dict__,
    }