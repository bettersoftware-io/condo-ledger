import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { formatAddress, parseAddressVO } from "../addressVO.ts";
import { assemble, type Seed } from "../assemble.ts";
import { buildDb } from "../db.ts";
import { parseTables, type Tables } from "../loadRows.ts";
import { identifierReplacements } from "./freeText.ts";
import { EXTRA_ENTRIES } from "./leftovers.ts";
import { TOWNS } from "./names.ts";
import {
  buildingTowns,
  isOutsideFreeText,
  LABEL_TABLES,
  pseudonymiseTables,
} from "./pseudonymise.ts";

// The real dump must never be committed again (the history is being purged);
// where it is absent this suite is skipped and says why. cwd is packages/legacy-import under Vitest (see specs/world.ts).
const DUMP_PATH = resolve(
  process.cwd(),
  "../../old/db/it-jtime-condominium.all.sql",
);
const HAS_DUMP = existsSync(DUMP_PATH);

describe.skipIf(!HAS_DUMP)(
  `pseudonymise over the real dump${HAS_DUMP ? "" : " (SKIPPED: old/db/it-jtime-condominium.all.sql is not on this machine)"}`,
  () => {
    it("leaves no original name, code, contact or address anywhere in the seed", () => {
      const { tables, seed } = load();
      const json = JSON.stringify(seed);
      const leaks = originalValues(tables).filter((value) => {
        return wholeWord(value).test(json);
      });

      expect(originalValues(tables).length).toBeGreaterThan(250);
      expect(leaks).toEqual([]);
    });

    it("leaves the lookup and label tables exactly as they were", () => {
      const { tables, pseudonymised } = load();

      for (const table of LABEL_TABLES) {
        expect(pseudonymised[table], table).toEqual(tables[table]);
      }
    });

    it("pins three pseudonyms, so a regeneration cannot drift", () => {
      const { seed } = load();
      const byId = new Map(
        seed.anagrafiche.map((a) => {
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

// The seed exactly as generate-data.ts builds it.
function load(): Loaded {
  if (!cached) {
    const tables = parseTables(readFileSync(DUMP_PATH, "utf8"));
    const pseudonymised = pseudonymiseTables(tables);
    cached = {
      tables,
      pseudonymised,
      seed: assemble(buildDb(pseudonymised)),
    };
  }

  return cached;
}

function originalValues(tables: Tables): string[] {
  const out = new Set<string>();
  const buildingFirms = buildingFirmIds(tables);

  function add(value: unknown, minLength = 3): void {
    if (typeof value === "string" && value.trim().length >= minLength) {
      out.add(value.trim());
    }
  }

  for (const p of tables.person ?? []) {
    add(p.firstName);
    add(p.lastName);
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
  for (const entry of EXTRA_ENTRIES) {
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
  seed: Seed;
}

let cached: Loaded | null = null;

// The value as a whole word, in any letter case: "Invito" does not leak "vito".
function wholeWord(value: string): RegExp {
  const escaped = JSON.stringify(value)
    .slice(1, -1)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
}
