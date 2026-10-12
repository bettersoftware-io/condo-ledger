import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { legacyDumpDir } from "../legacyDump.ts";
import type { NameEntry } from "./freeText.ts";

// Real firms typed by hand into free text (journal and account names,
// calendar notes) have no master-data entry of their own, so neither the
// person nor the company rule reaches them. Their names are real, so they are
// not in the repository: they live in leftovers.json beside the dump (old/db,
// never committed), each with its fixed fake:
//
//   { "entries": [ { "original": "…", "replacement": "…", "anyCase": true } ] }
//
// Without the file nothing extra is rewritten; the dump test fails if the dump
// is present and the file is not.

const LEFTOVERS_FILE = "leftovers.json";

interface LeftoversFile {
  entries: LeftoverRow[];
}

interface LeftoverRow {
  original: string;
  replacement: string;
  anyCase?: boolean;
}

/** The extra originals to rewrite, from leftovers.json in `dumpDir`; none when the file is absent. */
export function loadExtraEntries(
  dumpDir: string = legacyDumpDir(),
): NameEntry[] {
  const path = resolve(dumpDir, LEFTOVERS_FILE);

  if (!existsSync(path)) {
    return [];
  }

  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));

  if (!isLeftoversFile(parsed)) {
    throw new Error(
      `${path}: expected { "entries": [ { "original": string, "replacement": string, "anyCase"?: boolean } ] }`,
    );
  }

  return parsed.entries.map((row) => {
    return {
      original: row.original,
      pseudonym: row.replacement,
      anyCase: row.anyCase === true,
    };
  });
}

function isLeftoversFile(value: unknown): value is LeftoversFile {
  if (typeof value !== "object" || value === null || !("entries" in value)) {
    return false;
  }

  const { entries } = value;
  return Array.isArray(entries) && entries.every(isLeftoverRow);
}

function isLeftoverRow(value: unknown): value is LeftoverRow {
  return (
    typeof value === "object" &&
    value !== null &&
    "original" in value &&
    typeof value.original === "string" &&
    "replacement" in value &&
    typeof value.replacement === "string" &&
    (!("anyCase" in value) || typeof value.anyCase === "boolean")
  );
}
