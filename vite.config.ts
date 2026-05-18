import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-tanstack': ['@tanstack/react-query', '@tanstack/react-router'],
            'vendor-ui': ['lucide-react', 'framer-motion'],
            'vendor-supabase': ['@supabase/supabase-js'],
          }
        }
      }
    }
  }
});
