# Production image for the AuraForge store: Next.js 15 (React + Node.js server) with Prisma/MongoDB.
#
# This file lives at the TOP of the repository so Coolify (and `docker build .`) find it with
# default settings. The application itself is in the auraforge-store/ folder.
#   Build:  docker build -t auraforge .
#   Run:    docker run -p 3000:3000 -e DATABASE_URL=... -e JWT_SECRET=... auraforge
# For the store + its MongoDB together, use docker-compose.yaml (recommended on Coolify).

ARG APP_DIR=auraforge-store

# ---------- 1. Install dependencies (dev dependencies are needed for the build) ----------
FROM node:20-bookworm-slim AS deps
ARG APP_DIR
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY ${APP_DIR}/package.json ${APP_DIR}/package-lock.json* ./
# The schema is needed because `npm install` runs `prisma generate` (postinstall).
COPY ${APP_DIR}/prisma ./prisma
RUN if [ -f package-lock.json ]; then npm ci --include=dev; else npm install --include=dev --no-audit --no-fund; fi

# ---------- 2. Build the Next.js production bundle ----------
FROM node:20-bookworm-slim AS build
ARG APP_DIR
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY ${APP_DIR}/ ./
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
# The build never connects to the database; a placeholder only satisfies Prisma's config check.
RUN DATABASE_URL="mongodb://build-placeholder:27017/auraforge?replicaSet=rs0" npx prisma generate \
 && DATABASE_URL="mongodb://build-placeholder:27017/auraforge?replicaSet=rs0" npx next build

# ---------- 3. Run ----------
FROM node:20-bookworm-slim AS run
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates wget && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# node_modules is kept whole: the start command needs the Prisma CLI (db push) and tsx (starter catalog).
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
# On every start: create/sync database indexes, load the starter catalog only if the database is
# empty (restarts never undo Admin Portal edits), then serve on 0.0.0.0:$PORT.
CMD ["sh", "-c", "if [ -z \"$DATABASE_URL\" ]; then echo 'ERROR: DATABASE_URL is not set. Use docker-compose.yaml (includes MongoDB) or set DATABASE_URL to a MongoDB replica set.' >&2; exit 1; fi; npx prisma db push --skip-generate && npx tsx scripts/seed-if-empty.ts && exec npx next start -H 0.0.0.0 -p ${PORT:-3000}"]
