import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      host: "::",
      port: 8080,
    },
    resolve: {
      alias: {
        "h3-v2": "h3",
      },
    },
  }
});