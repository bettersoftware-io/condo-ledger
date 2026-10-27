import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import { assemble } from "./assemble.ts";
import { buildDb } from "./db.ts";
import { parseTables } from "./loadRows.ts";
import {
  projectLegacySeed,
  renderLegacySeedModule,
} from "./project/legacySeed.ts";
import { loadExtraEntries } from "./pseudonymise/leftovers.ts";
import { pseudonymiseTables } from "./pseudonymise/pseudonymise.ts";
import { reconcilePeriods } from "./reconcile.ts";
import { translateLegacySeed } from "./translate/translateSeed.ts";

// old/db under the repository root, or the folder LEGACY_DUMP_DIR names (a
// worktree has no old/: it is kept in the project's own checkout).
const DUMP_URL = new URL(
  "it-jtime-condominium.all.sql",
  process.env.LEGACY_DUMP_DIR === undefined
    ? new URL("../../../old/db/", import.meta.url)
    : pathToFileURL(`${process.env.LEGACY_DUMP_DIR}/`),
);
const OUT_URL = new URL("../seed/data.generated.json", import.meta.url);
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
const status = reconcilePeriods(db);
const seed = assemble(db);

// ---- Report ----
console.log(`Condominiums: ${seed.tree.length}`);
console.log(
  `Anagrafiche:  ${seed.anagrafiche.length} (categories: ${seed.anagraficaCategories.length})`,
);
console.log(
  `Calendar events: ${seed.calendarEvents.length} (layers: ${seed.calendarLayers.length})`,
);
console.log("");

for (const c of seed.tree) {
  console.log(`${c.code} — ${c.name}`);

  for (const p of c.periods) {
    const lp = p.id.replace(/^p/, "");
    const st = status[lp];
    let label: string;

    if (st?.hasBooks && st?.reconciles) {
      label = "books OK";
    } else if (st?.hasBooks && !st?.reconciles) {
      label = "BOOKS UNBALANCED → accounting omitted";
    } else {
      label = "structure-only";
    }

    console.log(`  ${p.id} ${p.name}: ${label}`);
  }
}

writeFileSync(OUT_URL, `${JSON.stringify(seed, null, 2)}\n`);
console.log("");
console.log(`Wrote ${OUT_URL.pathname}`);

// The M1 simulators' seed, from the same pseudonymised db, its text in
// English (the dump stays Italian; see src/translate/).
writeFileSync(
  SEED_MODULE_URL,
  renderLegacySeedModule(translateLegacySeed(projectLegacySeed(db))),
);
console.log(`Wrote ${SEED_MODULE_URL.pathname}`);
