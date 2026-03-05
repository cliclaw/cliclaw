import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/core/types.ts"],
      reporter: ["text", "text-summary"],
    },
  },
  resolve: {
    alias: {
      "../src": new URL("./src", import.meta.url).pathname,
    },
  },
});
