# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json bun.lockb ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist

EXPOSE 8080

CMD ["sh", "-c", "PORT=8080 node dist/server/index.mjs"]
