import asyncio
import json
from datetime import datetime, timezone
from redis import Redis
from app.workers.celery_app import celery
from app.db.session import connect_db
from app.db.models import Alert, Coin
import os

redis_client = Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379"))


def _check(alert: Alert, price: float) -> bool:
    if alert.condition == "above":
        return price > alert.threshold
    if alert.condition == "below":
        return price < alert.threshold
    return False  # pct_change handled separately


async def _run():
    await connect_db()
    alerts = await Alert.find(Alert.active == True, Alert.triggered == False).to_list()

    if not alerts:
        return

    # Build price map from Redis cache (fast path)
    price_map: dict[str, float] = {}
    for alert in alerts:
        if alert.coinId not in price_map:
            raw = redis_client.get(f"price:{alert.coinId}")
            if raw:
                data = json.loads(raw)
                price_map[alert.coinId] = data.get("price", 0)

    fired: list[dict] = []
    for alert in alerts:
        price = price_map.get(alert.coinId)
        if price is None:
            continue
        if _check(alert, price):
            alert.triggered   = True
            alert.triggeredAt = datetime.now(timezone.utc)
            await alert.save()
            fired.append({
                "alertId": str(alert.id),
                "userId":  alert.userId,
                "coinId":  alert.coinId,
                "condition": alert.condition,
                "threshold": alert.threshold,
                "price":   price,
            })

    if fired:
        redis_client.publish("alerts", json.dumps(fired))


@celery.task(name="app.workers.alert_eval.evaluate_alerts")
def evaluate_alerts():
    asyncio.run(_run())