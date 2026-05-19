import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    build: {
      chunkSizeWarningLimit: 2000,
      minify: 'esbuild',
      cssCodeSplit: true,
      sourcemap: false,
      rollupOptions: {
        maxParallelFileOps: 1,
        cache: false,
        output: {
          manualChunks: undefined
        }
      }
    },
    preview: {
      port: 80,
      host: true
    },
    // Garante que o build possa ser servido corretamente
    server: {
      port: 80,
      host: true
    }
  }
});