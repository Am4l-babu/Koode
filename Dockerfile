# syntax=docker/dockerfile:1.7
# ── Sahaya Bridge — production image (Next.js standalone) ─────────────────

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install all dependencies (dev deps are needed to build and to run migrations)
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Build
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npx next build

# One-off migration / seed runner (used by docker-compose "migrate" service)
FROM deps AS migrate
COPY . .
RUN npx prisma generate
CMD ["npx", "prisma", "migrate", "deploy"]

# Minimal runtime
FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app \
  && mkdir -p /app/storage/private && chown -R app:app /app/storage
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
# Private verification documents live in a volume, never in the image.
VOLUME ["/app/storage/private"]
CMD ["node", "server.js"]
