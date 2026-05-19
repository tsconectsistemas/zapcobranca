import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    build: {
      chunkSizeWarningLimit: 2000,
      minify: 'esbuild',
      cssCodeSplit: true,
      sourcemap: false,
    },
    // As configurações de server/preview aqui são para desenvolvimento local
    server: {
      host: true,
    },
  }
});