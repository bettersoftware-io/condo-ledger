import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import "./steps.ts"; // registers all step definitions (side effect)
import { runFeatureFiles } from "./gherkin/run.ts";
import { makeWorld } from "./world.ts";

// __dirname is NOT a URL read of the dump, so import.meta.url is fine here for locating features.
const featuresDir = resolve(dirname(fileURLToPath(import.meta.url)), "features");
runFeatureFiles(featuresDir, makeWorld);
