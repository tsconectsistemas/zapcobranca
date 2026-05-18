# Estágio de Build
FROM node:20-slim AS build

# Instalar o bun para um build mais rápido
RUN npm install -g bun

WORKDIR /app

# Copiar arquivos de dependência
COPY package.json bun.lockb* ./

# Instalar dependências
RUN bun install

# Copiar o restante do código
COPY . .

# Build da aplicação
RUN bun run build

# Estágio de Produção com Nginx
FROM nginx:alpine

# Copiar o build para o diretório do nginx
# O diretório 'dist' é o padrão do Vite
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar configuração customizada do Nginx para suportar SPA (Single Page Application)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
