# Estágio de Build
FROM oven/bun:1-slim AS build

WORKDIR /app

# Copiar arquivos de dependência
COPY package.json bun.lockb* ./

# Instalar dependências
RUN bun install --frozen-lockfile

# Copiar o restante do código
COPY . .

# Build da aplicação com limites de memória e otimizações
# NODE_OPTIONS pode ser respeitado por alguns subprocessos do Vite/Rollup
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN bun run build

# Estágio de Produção com Nginx
FROM nginx:alpine

# Copiar o build para o diretório do nginx
# O diretório 'dist' é o padrão do Vite para client-side
# Para TanStack Start, pode ser .output ou dist/client dependendo da config
# Vamos assumir dist por enquanto, mas se for SSR, o deploy muda.
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar configuração customizada do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
