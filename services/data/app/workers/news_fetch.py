import asyncio
from app.workers.celery_app import celery
from app.db.session import connect_db
from app.db.models import Article
from app.ingest.news import fetch_articles
from app.analysis.sentiment import score_article
from pymongo.errors import DuplicateKeyError


async def _run():
    await connect_db()
    raw_articles = fetch_articles()
    inserted = 0

    for data in raw_articles:
        # Score sentiment if not already set
        sentiment = score_article(data["title"], data.get("summary"))
        try:
            await Article.insert_one(Article(
                **{k: v for k, v in data.items() if k != "sentiment"},
                sentiment=sentiment,
            ))
            inserted += 1
        except DuplicateKeyError:
            pass  # already stored

    print(f"[NewsFetch] Inserted {inserted}/{len(raw_articles)} articles")


@celery.task(name="app.workers.news_fetch.fetch_news")
def fetch_news():
    asyncio.run(_run())