# Estágio de Build e Execução
FROM oven/bun:1-slim

WORKDIR /app

# Copiar arquivos de dependência
COPY package.json bun.lockb* ./

# Instalar dependências
RUN bun install

# Copiar o restante do código
COPY . .

# Variáveis de ambiente para o build e runtime
ENV NODE_ENV=production
ENV NITRO_PRESET=bun
ENV PORT=80
ENV HOST=0.0.0.0
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Realizar o build da aplicação
RUN bun run build

# Expor a porta 80
EXPOSE 80

# Comando para iniciar o servidor do TanStack Start
CMD ["bun", ".output/server/index.mjs"]
