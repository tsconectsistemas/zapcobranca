import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    build: {
      chunkSizeWarningLimit: 2000,
      minify: 'esbuild', // Esbuild is faster and uses less memory than Terser
      cssCodeSplit: true,
      sourcemap: false,
      rollupOptions: {
        maxParallelFileOps: 1, // Minimize memory usage
        cache: false,

        output: {
          manualChunks: undefined // Let Rollup decide to save memory during analysis
        }
      }
    }
  }
});
