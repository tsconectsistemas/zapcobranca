import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      host: "::",
      port: 8080,
    },
    ssr: {
      noExternal: ["h3", "h3-v2"],
    },
  }
});
