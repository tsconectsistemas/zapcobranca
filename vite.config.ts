import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    build: {
      chunkSizeWarningLimit: 2000,
      minify: 'esbuild',
      cssCodeSplit: true,
      sourcemap: false,
    },
    server: {
      host: true,
      port: 3000,
    },
    preview: {
      host: true,
      port: 3000,
    }
  },
  // @ts-ignore
  nitro: {
    preset: 'node-server'
  }
});