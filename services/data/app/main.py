from contextlib import asynccontextmanager
from fastapi import FastAPI
from pydantic_settings import BaseSettings
from app.db.session import connect_db, close_db
from app.api.router import router


class Settings(BaseSettings):
    mongo_url:          str = "mongodb://localhost:27017"
    redis_url:          str = "redis://redis:6379"
    coingecko_api_key:  str = ""

    class Config:
        env_file = ".env"


settings = Settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(title="Crypto Data Service", lifespan=lifespan)
app.include_router(router)