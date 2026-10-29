import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "#/db.ts";
import {
  DUMP_SUITE_TIMEOUT_MS,
  dumpSuiteName,
  legacyDumpAvailable,
} from "#/legacyDump.ts";

import {
  entryCount,
  installmentItemTotalCents,
  rawTrialBalanceCents,
} from "./oracle.ts";
import { legacyDb } from "./world.ts";

describe.skipIf(!legacyDumpAvailable())(
  dumpSuiteName("legacy oracles"),
  { timeout: DUMP_SUITE_TIMEOUT_MS },
  () => {
    beforeAll(() => {
      db = legacyDb();
    }, DUMP_SUITE_TIMEOUT_MS);

    it("trial balance nets to zero for the reconciling periods", () => {
      expect(Math.abs(rawTrialBalanceCents(db, "1"))).toBeLessThanOrEqual(1);
      expect(Math.abs(rawTrialBalanceCents(db, "36"))).toBeLessThanOrEqual(1);
    });
    it("the reconciling periods have posted entries", () => {
      expect(entryCount(db, "1")).toBeGreaterThan(0);
      expect(entryCount(db, "36")).toBeGreaterThan(0);
    });
    it("installment items total to a positive amount", () => {
      expect(installmentItemTotalCents(db, "36")).toBeGreaterThan(0);
    });

    let db: Db;
  },
);
