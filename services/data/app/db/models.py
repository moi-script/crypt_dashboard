from beanie import Document, TimeSeriesConfig, Granularity
from pymongo import IndexModel, ASCENDING, DESCENDING
from datetime import datetime
from typing import Optional
from pydantic import Field


class Coin(Document):
    coinId:    str
    symbol:    str
    name:      str
    image:     Optional[str] = None
    rank:      Optional[int] = None
    price:     float = 0
    change24h: float = 0
    volume24h: float = 0
    marketCap: float = 0
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "coins"
        indexes = [IndexModel([("coinId", ASCENDING)], unique=True)]


class Price(Document):
    time:      datetime
    coinId:    str
    price:     float
    volume24h: Optional[float] = None
    change24h: Optional[float] = None
    marketCap: Optional[float] = None

    class Settings:
        name = "prices"
        timeseries = TimeSeriesConfig(
            time_field="time",
            meta_field="coinId",
            granularity=Granularity.seconds,
        )
        indexes = [IndexModel([("coinId", ASCENDING), ("time", DESCENDING)])]


class OHLCV(Document):
    time:   datetime
    coinId: str
    open:   float
    high:   float
    low:    float
    close:  float
    volume: float

    class Settings:
        name = "ohlcv"
        timeseries = TimeSeriesConfig(
            time_field="time",
            meta_field="coinId",
            granularity=Granularity.seconds,
        )
        indexes = [IndexModel([("coinId", ASCENDING), ("time", DESCENDING)])]


class Indicator(Document):
    time:     datetime
    coinId:   str
    rsi14:    Optional[float] = None
    macd:     Optional[float] = None
    signal:   Optional[float] = None
    sma20:    Optional[float] = None
    ema50:    Optional[float] = None
    bb_upper: Optional[float] = None
    bb_lower: Optional[float] = None

    class Settings:
        name = "indicators"
        indexes = [IndexModel([("coinId", ASCENDING), ("time", DESCENDING)])]


class Article(Document):
    title:       str
    url:         str
    source:      str
    publishedAt: datetime
    summary:     Optional[str] = None
    sentiment:   Optional[float] = None  # -1 to 1
    coins:       list[str] = []
    imageUrl:    Optional[str] = None

    class Settings:
        name = "articles"
        indexes = [
            IndexModel([("url", ASCENDING)], unique=True),
            IndexModel([("publishedAt", DESCENDING)]),
            IndexModel([("coins", ASCENDING), ("publishedAt", DESCENDING)]),
        ]


class Alert(Document):
    userId:      str
    coinId:      str
    condition:   str  # "above" | "below" | "pct_change"
    threshold:   float
    triggered:   bool = False
    active:      bool = True
    triggeredAt: Optional[datetime] = None

    class Settings:
        name = "alerts"
        indexes = [
            IndexModel([("userId", ASCENDING), ("coinId", ASCENDING)]),
            IndexModel([("active", ASCENDING)]),
        ]


class User(Document):
    email:        str
    passwordHash: str
    createdAt:    datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"
        indexes = [IndexModel([("email", ASCENDING)], unique=True)]