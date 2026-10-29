import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildDb } from "./db.ts";
import { parseTables } from "./loadRows.ts";
import {
  projectLegacySeed,
  renderLegacySeedModule,
} from "./project/legacySeed.ts";
import { loadExtraEntries } from "./pseudonymise/leftovers.ts";
import { pseudonymiseTables } from "./pseudonymise/pseudonymise.ts";
import { translateLegacySeed } from "./translate/translateSeed.ts";

// old/db under the repository root, or the folder LEGACY_DUMP_DIR names (a
// worktree has no old/: it is kept in the project's own checkout).
const DUMP_URL = new URL(
  "it-jtime-condominium.all.sql",
  process.env.LEGACY_DUMP_DIR === undefined
    ? new URL("../../../old/db/", import.meta.url)
    : pathToFileURL(`${process.env.LEGACY_DUMP_DIR}/`),
);

const SEED_MODULE_URL = new URL(
  "../../domain/src/simulators/seed/legacySeed.generated.ts",
  import.meta.url,
);

// The dump holds real people: every identity is replaced by a fake one before
// anything is projected from it.
const db = buildDb(
  pseudonymiseTables(
    parseTables(readFileSync(DUMP_URL, "utf8")),
    loadExtraEntries(fileURLToPath(new URL(".", DUMP_URL))),
  ),
);

// The simulators' seed, from the pseudonymised db, its text in
// English (the dump stays Italian; see src/translate/).
writeFileSync(
  SEED_MODULE_URL,
  renderLegacySeedModule(translateLegacySeed(projectLegacySeed(db))),
);
console.log(`Wrote ${SEED_MODULE_URL.pathname}`);
