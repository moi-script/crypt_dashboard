import asyncio
from datetime import datetime, timezone
from app.workers.celery_app import celery
from app.db.session import connect_db
from app.db.models import OHLCV, Indicator, Coin
from app.analysis.indicators import compute_snapshot


async def _run():
    await connect_db()
    coins = await Coin.find_all().to_list()

    for coin in coins:
        # Pull last 200 close prices for this coin
        candles = (
            await OHLCV.find(OHLCV.coinId == coin.coinId)
            .sort(-OHLCV.time)
            .limit(200)
            .to_list()
        )
        if len(candles) < 20:
            continue

        closes = [c.close for c in reversed(candles)]  # oldest → newest
        snap   = compute_snapshot(closes)

        await Indicator.insert_one(Indicator(
            coinId=   coin.coinId,
            time=     datetime.now(timezone.utc),
            rsi14=    snap.rsi14,
            macd=     snap.macd,
            signal=   snap.signal,
            sma20=    snap.sma20,
            ema50=    snap.ema50,
            bb_upper= snap.bb_upper,
            bb_lower= snap.bb_lower,
        ))


@celery.task(name="app.workers.indicator_update.update_indicators")
def update_indicators():
    asyncio.run(_run())