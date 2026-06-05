from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.db.models import Coin, Price, OHLCV, Indicator, Article, Alert, User
import os

_client: AsyncIOMotorClient | None = None


async def connect_db() -> None:
    global _client
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    _client = AsyncIOMotorClient(mongo_url)
    await init_beanie(
        database=_client.crypto,
        document_models=[Coin, Price, OHLCV, Indicator, Article, Alert, User],
    )


async def close_db() -> None:
    if _client:
        _client.close()