import type { ProjectCoverageConfig } from "./coverage/lib/config.mts";

// What this project leaves out of the coverage measurement, and why. Every
// entry needs its reason. The bar and the default exclusions (test code) are
// in tools/coverage/lib/config.mts, which belongs to the add-on.
const config: ProjectCoverageConfig = {
  exclude: {
    "packages/client-react/src/main.tsx":
      "the browser's entry point: it only calls startApp(), which is tested; importing it in a test would start the app",
    "packages/server/src/index.ts":
      "the server's entry point: it only reads the port and calls startServer(), which is tested; importing it in a test would start a server",
    "packages/db/src/**":
      "the legacy schema and its connection, carried over from the DB migration; its ETL suites need a live Postgres and skip without one. Measured from M3, when the server adapters are written over it",
    "packages/legacy-import/src/**":
      "the offline generator carried over from the prototype; its correctness is held by the parity specs against the dump, not by per-file coverage. Measured from M3, when it becomes the import path",
  },
};

export default config;
