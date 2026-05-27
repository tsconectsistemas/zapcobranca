import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        "h3-v2": "h3",
      },
    },
    server: {
      host: "::",
      port: 8080,
    },
  }
});
