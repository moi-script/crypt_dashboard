# ── Base ──────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app


# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps

COPY pyproject.toml ./
# Install production deps only (no [dev] extras)
RUN pip install --no-cache-dir ".[standard]" 2>/dev/null || pip install --no-cache-dir .


# ── Runtime ───────────────────────────────────────────────────────────────────
FROM base AS runtime

COPY --from=deps /usr/local/lib/python3.12 /usr/local/lib/python3.12
COPY --from=deps /usr/local/bin /usr/local/bin

COPY app ./app

EXPOSE 8001

# Default command runs the FastAPI server.
# docker-compose overrides this for worker and beat containers.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]