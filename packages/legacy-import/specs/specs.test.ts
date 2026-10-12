import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe } from "vitest";

import { dumpSuiteName, legacyDumpAvailable } from "#/legacyDump.ts";

import { runFeatureFiles } from "./gherkin/run.ts";
import "./steps.ts"; // registers all step definitions (side effect)
import { makeWorld } from "./world.ts";

// __dirname is NOT a URL read of the dump, so import.meta.url is fine here for locating features.
const featuresDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "features",
);
describe.skipIf(!legacyDumpAvailable())(dumpSuiteName("parity specs"), () => {
  runFeatureFiles(featuresDir, makeWorld);
});
