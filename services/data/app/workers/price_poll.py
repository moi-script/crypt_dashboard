import asyncio
import json
from datetime import datetime, timezone
from redis import Redis
from app.workers.celery_app import celery
from app.db.session import connect_db
from app.db.models import Price, Coin
from app.ingest.coingecko import CoinGeckoSource
import os

redis_client = Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379"))
source = CoinGeckoSource()


async def _save_and_publish(prices: list[dict]):
    await connect_db()

    # Upsert Coin documents with latest price metadata
    for p in prices:
        await Coin.find_one(Coin.coinId == p["coinId"]).upsert(
            {"$set": {
                "symbol":    p["symbol"],
                "name":      p["name"],
                "image":     p.get("image"),
                "rank":      p.get("rank"),
                "price":     p["price"],
                "change24h": p["change24h"],
                "volume24h": p["volume24h"],
                "marketCap": p["marketCap"],
                "updatedAt": datetime.now(timezone.utc),
            }},
            on_insert=Coin(**{k: v for k, v in p.items() if k != "time"}),
        )

    # Insert price timeseries records
    records = [
        Price(
            time=      p["time"],
            coinId=    p["coinId"],
            price=     p["price"],
            change24h= p["change24h"],
            volume24h= p["volume24h"],
            marketCap= p["marketCap"],
        )
        for p in prices
    ]
    await Price.insert_many(records)

    # Publish to Redis for WebSocket broadcast + set short-TTL cache
    for p in prices:
        payload = {"coinId": p["coinId"], "price": p["price"],
                   "change24h": p["change24h"], "volume24h": p["volume24h"]}
        redis_client.set(f"price:{p['coinId']}", json.dumps(payload), ex=60)

    redis_client.publish("prices", json.dumps([
        {"coinId": p["coinId"], "price": p["price"]} for p in prices
    ]))
    # Bust the coins:all cache so API serves fresh data
    redis_client.delete("coins:all")


@celery.task(name="app.workers.price_poll.poll_prices")
def poll_prices():
    prices = source.fetch_current()
    asyncio.run(_save_and_publish(prices))