import { defineConfig } from "vitest/config";

// Unit tests beside the source, and the parity specs (Gherkin over the legacy
// dump) under specs/. Both read old/db/… relative to this package's folder.
export default defineConfig({
  test: { include: ["src/**/*.test.ts", "specs/**/*.test.ts"] },
});
