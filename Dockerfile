# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS base
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS builder
COPY . .
ENV BUILD_STANDALONE=1 NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# Imagen con el CLI de Prisma para aplicar migraciones (servicio "migrate")
FROM deps AS migrate
COPY prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN useradd --system --uid 1001 app && mkdir -p /app/.uploads && chown app /app/.uploads
COPY --from=builder --chown=app /app/.next/standalone ./
COPY --from=builder --chown=app /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]
