import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Use node-server preset for general hosting (Docker/VPS)
  // This produces a server that can be run with Node or Bun
  // The output will be in .output/server/index.mjs
  nitro: {
    preset: "node-server",
  },
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
    }
  }
});
