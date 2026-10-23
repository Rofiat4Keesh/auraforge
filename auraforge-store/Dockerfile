# syntax=docker/dockerfile:1
# Production image for the AuraForge store (Next.js 15 + Prisma/MongoDB).
# Used by Coolify (docker-compose.coolify.yml) and works with plain `docker build` too.

# ---------- 1. Install dependencies (dev dependencies are needed to build) ----------
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN if [ -f package-lock.json ]; then npm ci --include=dev; else npm install --include=dev; fi

# ---------- 2. Build ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are baked into the build, so they arrive as build arguments.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_BASE_CURRENCY=NGN
ARG NEXT_PUBLIC_DISPLAY_CURRENCY=NGN
ARG NEXT_PUBLIC_NGN_PER_USD=1550
ARG NEXT_PUBLIC_SUPPORT_EMAIL=
ARG NEXT_PUBLIC_SUPPORT_PHONE=
ARG NEXT_PUBLIC_BUSINESS_ADDRESS=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_BASE_CURRENCY=$NEXT_PUBLIC_BASE_CURRENCY \
    NEXT_PUBLIC_DISPLAY_CURRENCY=$NEXT_PUBLIC_DISPLAY_CURRENCY \
    NEXT_PUBLIC_NGN_PER_USD=$NEXT_PUBLIC_NGN_PER_USD \
    NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL \
    NEXT_PUBLIC_SUPPORT_PHONE=$NEXT_PUBLIC_SUPPORT_PHONE \
    NEXT_PUBLIC_BUSINESS_ADDRESS=$NEXT_PUBLIC_BUSINESS_ADDRESS \
    NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npx next build

# ---------- 3. Run ----------
FROM node:20-bookworm-slim AS run
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates wget && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# node_modules is kept whole: the start script needs the Prisma CLI (db push) and tsx (catalog seed).
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
# On every start: sync database indexes, load the starter catalog only if the database is empty, then serve.
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx scripts/seed-if-empty.ts && exec npx next start -H 0.0.0.0 -p ${PORT:-3000}"]
