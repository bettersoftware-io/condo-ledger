import { existsSync } from "node:fs";
import { resolve } from "node:path";

const DUMP_FILE = "it-jtime-condominium.all.sql";

/**
 * How long a suite that reads the dump, and a hook that parses it, may take.
 * Parsing the 48 MB dump takes about 5 s alone and far longer when every dump
 * suite of this package parses it at once under coverage instrumentation, so
 * Vitest's 5 s test default and 10 s hook default both fail there. Each dump
 * suite passes this itself; the unit tests keep the defaults.
 */
export const DUMP_SUITE_TIMEOUT_MS = 60_000;

/**
 * Where the real legacy dump is: old/db under the repository root, or the folder
 * named by LEGACY_DUMP_DIR. The dump is kept on one machine and is not in git.
 * cwd is packages/legacy-import under Vitest (see specs/world.ts).
 */
export function legacyDumpPath(): string {
  return resolve(legacyDumpDir(), DUMP_FILE);
}

/** The folder of the dump, and of the local files kept beside it (old/db, or LEGACY_DUMP_DIR). */
export function legacyDumpDir(): string {
  return process.env.LEGACY_DUMP_DIR ?? resolve(process.cwd(), "../../old/db");
}

export function legacyDumpAvailable(): boolean {
  return existsSync(legacyDumpPath());
}

/** A suite name that says, when the dump is missing, that the suite is skipped and why. */
export function dumpSuiteName(name: string): string {
  return legacyDumpAvailable()
    ? name
    : `${name} (SKIPPED: ${legacyDumpPath()} is not on this machine)`;
}
