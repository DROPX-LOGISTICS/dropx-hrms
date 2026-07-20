import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/lib/validation.ts", "src/lib/permissions.ts"],
      thresholds: { lines: 100, functions: 100, statements: 100, branches: 90 }
    }
  }
});
