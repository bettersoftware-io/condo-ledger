import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The legacy dumps live in old/db under the repository root, or in the folder
 * named by LEGACY_DUMP_DIR. They are kept on one machine and are not in git.
 * cwd is packages/db under Vitest.
 */
export function legacyDumpFile(name: string): string {
  const dir =
    process.env.LEGACY_DUMP_DIR ?? resolve(process.cwd(), "../../old/db");

  return resolve(dir, name);
}

export function legacyDumpAvailable(name: string): boolean {
  return existsSync(legacyDumpFile(name));
}

/** A suite name that says, when the dump is missing, that the suite is skipped and why. */
export function dumpSuiteName(suite: string, name: string): string {
  return legacyDumpAvailable(name)
    ? suite
    : `${suite} (SKIPPED: ${legacyDumpFile(name)} is not on this machine)`;
}
