import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        "h3-v2": "h3",
      },
    },
    ssr: {
      noExternal: [/^(?!react|react-dom|react\/jsx-runtime).*$/],
    },
    server: {
      host: "::",
      port: 8080,
    },
  }
});
