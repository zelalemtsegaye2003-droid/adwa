# ── Adwa Cyber — production image (Bun + Next.js standalone) ───────────────
# Build:  docker build -t adwa-cyber .
# Run:    docker compose up -d   (see docker-compose.yml)
#
# The image swaps prisma/schema.prisma for the PostgreSQL variant at build
# time (prisma/schema.postgres.prisma) — dev keeps SQLite untouched.

# 1 ─ Dependencies + build
FROM oven/bun:1 AS build
WORKDIR /app

# Prisma needs openssl for the query engine
RUN apt-get update -qq && apt-get install -y -qq openssl && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# PostgreSQL schema variant replaces the SQLite one for this build
COPY prisma ./prisma
RUN cp prisma/schema.postgres.prisma prisma/schema.prisma

COPY . .
# Dummy sqlite URL satisfies prisma generate during the Next build;
# the runtime uses the real DATABASE_URL env var.
ENV DATABASE_URL="file:/tmp/build.db"
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun prisma generate \
 && bun run build \
 && cp -r .next/static .next/standalone/.next/static \
 && cp -r public .next/standalone/public

# 2 ─ Runtime: full build context (node_modules + sources) so the
#     entrypoint can run migrations and seeds with bun directly.
FROM oven/bun:1 AS runtime
WORKDIR /app

RUN apt-get update -qq && apt-get install -y -qq openssl curl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
