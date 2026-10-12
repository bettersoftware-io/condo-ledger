import { defineConfig } from "vitest/config";

// Unit tests beside the source, and the parity specs (Gherkin over the legacy
// dump) under specs/. Both read old/db/… relative to this package's folder.
// The suites that parse the dump set their own timeout
// (DUMP_SUITE_TIMEOUT_MS in src/legacyDump.ts); the rest keep the defaults.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "specs/**/*.test.ts"],
  },
});
