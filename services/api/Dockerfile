# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig*.json ./
COPY src ./src
RUN npm run build


# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

ENV NODE_ENV=production
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface

WORKDIR /app

# onnxruntime-node requires libgomp (OpenMP) from glibc
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/dist ./dist

# Pre-download the embedding model so it's baked into the image
# and doesn't need a network call at runtime
RUN node -e "\
const t = require('@huggingface/transformers');\
t.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { device: 'cpu' })\
 .then(() => { console.log('Model cached.'); process.exit(0); })\
 .catch(e => { console.warn('Model pre-cache failed (non-fatal):', e.message); process.exit(0); });"

EXPOSE 4000

CMD ["node", "dist/app.js"]
