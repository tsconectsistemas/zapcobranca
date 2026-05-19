# Estágio de Build e Execução
FROM oven/bun:1-slim

WORKDIR /app

# Copiar arquivos de dependência
COPY package.json bun.lockb* ./

# Instalar dependências (incluindo devDependencies para o build e preview)
RUN bun install

# Copiar o restante do código
COPY . .

# Realizar o build da aplicação para o ambiente de servidor (Bun)
ENV NITRO_PRESET=bun
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN bun run build

# Expor a porta 80 para o Dokploy
EXPOSE 80
ENV PORT=80

# Comando para iniciar o servidor do TanStack Start
CMD ["bun", ".output/server/index.mjs"]
