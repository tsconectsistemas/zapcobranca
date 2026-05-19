# Estágio de Build e Execução
FROM oven/bun:1-slim

WORKDIR /app

# Copiar arquivos de dependência
COPY package.json bun.lockb* ./

# Instalar dependências
RUN bun install

# Copiar o restante do código
COPY . .

# Variáveis do Supabase (Buscadas do projeto Lovable)
ENV VITE_SUPABASE_URL="https://dxxbqeqdwagmtynfsmzw.supabase.co"
ENV VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4eGJxZXFkd2FnbXR5bmZzbXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDk4ODEsImV4cCI6MjA5MjEyNTg4MX0.PfT6gfYXtAnz9ipc_p24pdIojlLVsJkDkeNAo_m0sUc"
ENV SUPABASE_URL="https://dxxbqeqdwagmtynfsmzw.supabase.co"
ENV SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4eGJxZXFkd2FnbXR5bmZzbXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDk4ODEsImV4cCI6MjA5MjEyNTg4MX0.PfT6gfYXtAnz9ipc_p24pdIojlLVsJkDkeNAo_m0sUc"

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
