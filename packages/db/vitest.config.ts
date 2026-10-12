import { defineConfig } from "vitest/config";

// Unit tests need no DB. Integration tests require DATABASE_URL: each such file
// inlines `const d = url ? describe : describe.skip` and skips its suite when the
// var is absent. passWithNoTests lets a fully-skipped file pass the run.
export default defineConfig({
  test: {
    globals: true,
    include: ["test/**/*.test.ts"],
    passWithNoTests: true,
  },
});
