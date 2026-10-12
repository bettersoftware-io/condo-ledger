import { existsSync } from "node:fs";
import { resolve } from "node:path";

const DUMP_FILE = "it-jtime-condominium.all.sql";

/**
 * Where the real legacy dump is: old/db under the repository root, or the folder
 * named by LEGACY_DUMP_DIR. The dump is kept on one machine and is not in git.
 * cwd is packages/legacy-import under Vitest (see specs/world.ts).
 */
export function legacyDumpPath(): string {
  const dir =
    process.env.LEGACY_DUMP_DIR ?? resolve(process.cwd(), "../../old/db");

  return resolve(dir, DUMP_FILE);
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
