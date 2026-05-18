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
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('react')) return 'vendor-react';
              if (id.includes('@tanstack')) return 'vendor-tanstack';
              if (id.includes('@radix-ui')) return 'vendor-ui';
              if (id.includes('lucide')) return 'vendor-ui';
              if (id.includes('@supabase')) return 'vendor-supabase';
              return 'vendor-others';
            }
          }
        }
      }
    }
  }
});
