import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Next.js resolves "server-only" via its own webpack config; provide a no-op stand-in for Vitest.
      "server-only": fileURLToPath(new URL("./vitest.server-only-stub.ts", import.meta.url))
    }
  },
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
