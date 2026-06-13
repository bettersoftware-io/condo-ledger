import { readFileSync, writeFileSync } from "node:fs";
import { parseTables } from "./loadRows.ts";
import { buildDb } from "./db.ts";
import { reconcilePeriods } from "./reconcile.ts";
import { assemble } from "./assemble.ts";

const DUMP_URL = new URL("../../../../old/db/it-jtime-condominium.all.sql", import.meta.url);
const OUT_URL = new URL("../../src/mock/data.generated.json", import.meta.url);

const db = buildDb(parseTables(readFileSync(DUMP_URL, "utf8")));
const status = reconcilePeriods(db);
const seed = assemble(db);

// ---- Report ----
console.log(`Condominiums: ${seed.tree.length}`);
console.log(`Anagrafiche:  ${seed.anagrafiche.length} (categories: ${seed.anagraficaCategories.length})`);
console.log(`Calendar events: ${seed.calendarEvents.length} (layers: ${seed.calendarLayers.length})`);
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

writeFileSync(OUT_URL, JSON.stringify(seed, null, 2) + "\n");
console.log("");
console.log(`Wrote ${OUT_URL.pathname}`);
