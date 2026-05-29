import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: {
    preset: "node-server",
    devServer: {
      port: 8080,
    },
    runtimeConfig: {
      nitro: {
        port: 8080,
      },
    },
  },
  vite: {
    server: {
      host: "::",
      port: 8080,
    },
    ssr: {
      noExternal: ["h3", "h3-v2"],
    },
  },
});
