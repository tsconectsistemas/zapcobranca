# Estágio de Build e Execução
FROM oven/bun:1-slim

WORKDIR /app

# Copiar arquivos de dependência
COPY package.json bun.lockb* ./

# Instalar dependências (incluindo devDependencies para o build e preview)
RUN bun install

# Copiar o restante do código
COPY . .

# Realizar o build da aplicação
# O TanStack Start gera a saída em dist/client e dist/server
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN bun run build

# Expor a porta 80 para o Dokploy
EXPOSE 80

# Usamos o 'vite preview' para servir a aplicação na porta 80
CMD ["bun", "x", "vite", "preview", "--port", "80", "--host"]
