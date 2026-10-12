import { defineConfig } from "vitest/config";

// Unit tests beside the source, and the parity specs (Gherkin over the legacy
// dump) under specs/. Both read old/db/… relative to this package's folder.
// The first test in each spec file parses the 48 MB dump (about 5 s on its own,
// more while the other packages test in parallel), so the 5 s default is too
// short for it.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "specs/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
