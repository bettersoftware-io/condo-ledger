import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

import { parseTables } from "../loadRows.ts";
import { pseudonymiseTables } from "./pseudonymise.ts";
import { replaceTextLines } from "./replaceText.ts";

// node src/pseudonymise/exportMapping.ts <out-file>
//
// Writes the `git filter-repo --replace-text` file that carries the generator's
// pseudonymisation through the repository's history. The file holds the real
// names, so it is only ever written outside the repository.

const DUMP_URL = new URL(
  "../../../../old/db/it-jtime-condominium.all.sql",
  import.meta.url,
);

const target = process.argv[2];

if (target === undefined || target === "") {
  console.error(
    "usage: node src/pseudonymise/exportMapping.ts <out-file>  (a path outside the repository)",
  );
  process.exit(2);
}

const out = realTarget(resolve(process.cwd(), target));
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: import.meta.dirname,
  encoding: "utf8",
}).trim();
const fromRoot = relative(realpathSync(root), out);

if (fromRoot === "" || (!fromRoot.startsWith("..") && !isAbsolute(fromRoot))) {
  console.error(
    `refusing to write ${out}: it is inside the repository ${root}, and the mapping holds the real names`,
  );
  process.exit(1);
}

const tables = parseTables(readFileSync(DUMP_URL, "utf8"));
const lines = replaceTextLines(tables, pseudonymiseTables(tables));
writeFileSync(out, `${lines.join("\n")}\n`, { mode: 0o600 });
console.log(`Wrote ${String(lines.length)} replace-text lines to ${out}`);

// The path with its folder's symbolic links resolved (/tmp → /private/tmp),
// so the comparison with the repository's real path is fair.
function realTarget(path: string): string {
  const folder = dirname(path);
  return existsSync(folder)
    ? resolve(realpathSync(folder), basename(path))
    : path;
}
