from celery import Celery
from celery.schedules import crontab
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

celery = Celery(
    "crypto_data",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "app.workers.price_poll",
        "app.workers.indicator_update",
        "app.workers.alert_eval",
        "app.workers.news_fetch",
    ],
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)

celery.conf.beat_schedule = {
    # Price every 30 seconds
    "poll-prices": {
        "task": "app.workers.price_poll.poll_prices",
        "schedule": 30.0,
    },
    # Indicators every 5 minutes
    "update-indicators": {
        "task": "app.workers.indicator_update.update_indicators",
        "schedule": 300.0,
    },
    # News every 15 minutes
    "fetch-news": {
        "task": "app.workers.news_fetch.fetch_news",
        "schedule": 900.0,
    },
    # Alert evaluation every minute
    "eval-alerts": {
        "task": "app.workers.alert_eval.evaluate_alerts",
        "schedule": 60.0,
    },
}