# ── Build stage ──────────────────────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

# Instala dependências primeiro (cache de camada)
COPY package.json bun.lockb bunfig.toml ./
RUN bun install --frozen-lockfile

# Copia o restante do código
COPY . .

# Build da aplicação (client + server SSR)
RUN bun run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copia apenas o necessário do build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 8080

CMD ["bun", "run", "start"]
