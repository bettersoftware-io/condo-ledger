import { defineConfig } from "vitest/config";

// Unit tests need no DB. Integration tests require DATABASE_URL and are
// skipped (via test/_integrationGuard) when it is absent.
export default defineConfig({
  test: { globals: true, include: ["test/**/*.test.ts"] },
});
