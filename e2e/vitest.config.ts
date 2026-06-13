import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["e2e/*.test.ts", "e2e/vitest.config.ts"],
      include: ["e2e/*.ts"],
      provider: "istanbul",
      reporter: ["text", "lcov"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
    include: ["e2e/*.e2e.test.ts"],
  },
});
