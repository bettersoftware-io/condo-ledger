import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { LegacySeedData } from "@cl/domain";

import type { Anagrafica } from "#/seedTypes.ts";

import { formatAddress, parseAddressVO } from "../addressVO.ts";
import { buildDb } from "../db.ts";
import {
  DUMP_SUITE_TIMEOUT_MS,
  dumpSuiteName,
  legacyDumpAvailable,
  legacyDumpPath,
} from "../legacyDump.ts";
import { parseTables, type Tables } from "../loadRows.ts";
import { projectAnagrafiche } from "../project/anagrafiche.ts";
import { projectLegacySeed } from "../project/legacySeed.ts";
import { translateLegacySeed } from "../translate/translateSeed.ts";
import { identifierReplacements } from "./freeText.ts";
import { loadExtraEntries } from "./leftovers.ts";
import { TOWNS } from "./names.ts";
import {
  buildingTowns,
  isOutsideFreeText,
  LABEL_TABLES,
  pseudonymiseTables,
} from "./pseudonymise.ts";

// The real dump must never be committed again (the history is being purged);
// where it is absent this suite is skipped and says why.
describe.skipIf(!legacyDumpAvailable())(
  dumpSuiteName("pseudonymise over the real dump"),
  { timeout: DUMP_SUITE_TIMEOUT_MS },
  () => {
    it("leaves no original name, code, contact or address anywhere in the seed or the registry", () => {
      const { tables, seed, anagrafiche } = load();
      const json = JSON.stringify({ seed, anagrafiche });
      // A person's name is looked for outside the fake towns (a real
      // "Daniele" inside the fake "San Daniele del Friuli" is the town's);
      // every other value (a street, a firm, a code) in the whole text.
      const townless = withoutFakeTowns(json);
      const others = new Set(otherOriginalValues(tables));
      const leaks = originalValues(tables).filter((value) => {
        return wholeWord(value).test(others.has(value) ? json : townless);
      });

      expect(originalValues(tables).length).toBeGreaterThan(250);
      expect(leaks).toEqual([]);
    });

    it("has the local list of extra names beside the dump", () => {
      // Without old/db/leftovers.json the hand-typed firm names would pass
      // through unseen; where the dump is, the list must be too.
      expect(loadExtraEntries().length).toBeGreaterThan(0);
    });

    it("leaves the lookup and label tables exactly as they were", () => {
      const { tables, pseudonymised } = load();

      for (const table of LABEL_TABLES) {
        expect(pseudonymised[table], table).toEqual(tables[table]);
      }
    });

    it("pins three pseudonyms, so a regeneration cannot drift", () => {
      const { anagrafiche } = load();
      const byId = new Map(
        anagrafiche.map((a) => {
          return [a.id, a];
        }),
      );

      expect(byId.get("md3")?.nominativo).toBe("Cargnelutti Lidia");
      expect(byId.get("md12")).toMatchObject({
        nominativo: "Cattaruzzi Teodoro",
        codice: "TCATTA",
      });
      expect(byId.get("md17")).toMatchObject({
        nominativo: "Acque Arzino s.n.c.",
        codice: "ARZINO",
      });
    });
  },
);

// The simulators' seed exactly as generate-data.ts builds it, and the registry projected from the same db.
function load(): Loaded {
  if (!cached) {
    const tables = parseTables(readFileSync(legacyDumpPath(), "utf8"));
    const pseudonymised = pseudonymiseTables(tables, loadExtraEntries());
    const db = buildDb(pseudonymised);
    cached = {
      tables,
      pseudonymised,
      seed: translateLegacySeed(projectLegacySeed(db)),
      anagrafiche: projectAnagrafiche(db),
    };
  }

  return cached;
}

// Every original value the seed must not hold: the people's names and the rest.
function originalValues(tables: Tables): string[] {
  return [...new Set([...personNames(tables), ...otherOriginalValues(tables)])];
}

// The people's first and last names.
function personNames(tables: Tables): string[] {
  const out = new Set<string>();

  for (const p of tables.person ?? []) {
    for (const name of [p.firstName, p.lastName]) {
      if (typeof name === "string" && name.trim().length >= 3) {
        out.add(name.trim());
      }
    }
  }

  return [...out];
}

// The original values other than the people's names: firms, codes, contacts,
// streets and addresses, the buildings' real towns.
function otherOriginalValues(tables: Tables): string[] {
  const out = new Set<string>();
  const buildingFirms = buildingFirmIds(tables);

  function add(value: unknown, minLength = 3): void {
    if (typeof value === "string" && value.trim().length >= minLength) {
      out.add(value.trim());
    }
  }

  for (const c of tables.company ?? []) {
    if (!buildingFirms.has(String(c.masterDataId))) {
      add(c.name);
    }
  }

  for (const m of tables.masterData ?? []) {
    add(m.taxCode);
    add(m.vatNumber);
  }

  for (const c of tables.condominium ?? []) {
    add(c.taxCode);
  }

  for (const b of tables.bankAccount ?? []) {
    add(b.iban);
    add(b.accountNumber);
  }

  for (const c of tables.masterDataContact ?? []) {
    add(c.value);
  }

  // Real names typed in free text, and the buildings' real towns (except
  // those that are also in the fake town pool).
  for (const entry of loadExtraEntries()) {
    add(entry.original);
  }

  const fakeTowns = new Set(
    TOWNS.map((t) => {
      return t.name;
    }),
  );

  for (const town of buildingTowns(tables).values()) {
    if (!fakeTowns.has(town)) {
      add(town);
    }
  }

  // Identifiers typed into free text (phones, policy and account numbers).
  for (const [name, rows] of Object.entries(tables)) {
    if (isOutsideFreeText(name)) {
      continue;
    }

    for (const row of rows) {
      for (const value of Object.values(row)) {
        if (typeof value === "string") {
          for (const [found] of identifierReplacements(value)) {
            add(found, 6);
          }
        }
      }
    }
  }

  for (const [table, column] of ADDRESS_COLUMNS) {
    for (const row of tables[table] ?? []) {
      const blob = row[column];
      const fields = parseAddressVO(typeof blob === "string" ? blob : null);
      add(fields.street, 5);
      add(fields.streetName, 5);
      add(formatAddress(fields), 5);
    }
  }

  return [...out];
}

// A building's own master-data entry ("Condomìnio Saturno") keeps its name.
function buildingFirmIds(tables: Tables): Set<string> {
  const buildingCategories = new Set(
    (tables.masterDataCategory ?? [])
      .filter((c) => {
        return (
          String(c.name)
            .normalize("NFD")
            .replace(/\p{M}/gu, "")
            .toLowerCase() === "condominio"
        );
      })
      .map((c) => {
        return String(c.id);
      }),
  );
  return new Set(
    (tables.masterData ?? [])
      .filter((m) => {
        return buildingCategories.has(String(m.masterDataCategoryId));
      })
      .map((m) => {
        return String(m.id);
      }),
  );
}

// Columns that hold a serialized AddressVO in the identity tables.
const ADDRESS_COLUMNS: readonly (readonly [string, string])[] = [
  ["masterData", "postalAddress"],
  ["masterDataVariation", "postalAddress"],
  ["person", "birthPlace"],
  ["person", "officeAddress"],
  ["person", "permanentAddress"],
  ["person", "currentAddress"],
  ["company", "registeredOfficeAddress"],
  ["company", "taxPurposeAddress"],
  ["condominium", "address"],
  ["unitGroup", "address"],
  ["bankAccount", "branchAddress"],
];

interface Loaded {
  tables: Tables;
  pseudonymised: Tables;
  seed: LegacySeedData;
  anagrafiche: Anagrafica[];
}

let cached: Loaded | null = null;

// The text with every town of the fake pool taken out: a fake address names
// one ("San Daniele del Friuli"), and a real first name inside it is the
// town's, not the person's. Only people's names are looked for in it.
function withoutFakeTowns(text: string): string {
  return TOWNS.reduce((rest, town) => {
    return rest.replaceAll(town.name, "");
  }, text);
}

// The value as a whole word, in any letter case: a name inside a longer word is not a leak.
function wholeWord(value: string): RegExp {
  const escaped = JSON.stringify(value)
    .slice(1, -1)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
}
