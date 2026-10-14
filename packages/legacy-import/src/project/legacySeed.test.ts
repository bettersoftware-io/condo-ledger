import { readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";

import { buildDb, type Db } from "../db.ts";
import {
  DUMP_SUITE_TIMEOUT_MS,
  dumpSuiteName,
  legacyDumpAvailable,
  legacyDumpPath,
} from "../legacyDump.ts";
import { parseTables } from "../loadRows.ts";
import { loadExtraEntries } from "../pseudonymise/leftovers.ts";
import { pseudonymiseTables } from "../pseudonymise/pseudonymise.ts";
import { projectLegacySeed } from "./legacySeed.ts";

describe.skipIf(!legacyDumpAvailable())(
  dumpSuiteName("projectLegacySeed (real dump)"),
  { timeout: DUMP_SUITE_TIMEOUT_MS },
  () => {
    beforeAll(() => {
      db = buildDb(
        pseudonymiseTables(
          parseTables(readFileSync(legacyDumpPath(), "utf8")),
          loadExtraEntries(),
        ),
      );
      seed = projectLegacySeed(db);
    }, DUMP_SUITE_TIMEOUT_MS);

    it("keeps only the buildings and periods that have balanced books", () => {
      expect(
        seed.buildings.map((b) => {
          return [
            b.id,
            b.name,
            b.periods.map((p) => {
              return p.id;
            }),
          ];
        }),
      ).toEqual([
        ["c1", "Saturno", ["p1"]],
        ["c19", "Pozzetto", ["p36"]],
      ]);
    });

    it("emits every account of Pozzetto 2013 with its nature, type and role", () => {
      const accounts = seed.accounts.filter((a) => {
        return a.periodId === "p36";
      });

      const roles = new Map(
        accounts
          .filter((a) => {
            return a.role !== null;
          })
          .map((a) => {
            return [a.role, a.id];
          }),
      );

      expect(accounts).toHaveLength(82);
      expect(
        accounts
          .filter((a) => {
            return a.nature === "assetsOrLiabilities";
          })
          .map((a) => {
            return a.id;
          }),
      ).toEqual(["la157", "la158", "la159"]);
      expect(roles.get("suppliers")).toBe("la157");
      expect(roles.get("owners")).toBe("la158");
      expect(roles.get("roundings")).toBe("la159");
      expect(roles.get("bank")).toBe("la156");
      expect(roles.get("cash")).toBe("la154");
      expect(
        accounts.filter((a) => {
          return a.role === "tax";
        }),
      ).toHaveLength(5);
    });

    it("emits every transaction with its postings and counterparts", () => {
      const entries = seed.entries.filter((e) => {
        return e.periodId === "p36";
      });

      const postings = entries.flatMap((e) => {
        return e.postings;
      });

      const onControls = postings.filter((p) => {
        return ["la157", "la158", "la159"].includes(p.accountId);
      });

      expect(entries).toHaveLength(140);
      expect(postings).toHaveLength(540);
      // Rome time: the dump holds 14:59:29 (UTC, winter, +1h) and 15:05:51 (summer, +2h).
      expect(entries[1]).toMatchObject({
        id: "tx150",
        number: 2,
        at: "2013-01-10T15:59:29",
      });
      expect(
        entries.find((e) => {
          return e.id === "tx214";
        })?.at,
      ).toBe("2013-07-01T17:05:51");
      expect(
        onControls.every((p) => {
          return p.counterpart !== null;
        }),
      ).toBe(true);
    });

    it("types every entry: Pozzetto 2013 has eleven generic ones, Saturno 2011 five bank purchases", () => {
      const counts = new Map<string, number>();

      for (const entry of seed.entries) {
        const key = `${entry.periodId}:${entry.kind}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }

      expect(counts.get("p36:generic")).toBe(11);
      expect(counts.get("p36:invoice")).toBe(47);
      expect(counts.get("p36:invoicePayment")).toBe(43);
      expect(counts.get("p36:collection")).toBe(36);
      expect(counts.get("p1:directPaymentBank")).toBe(5);
      expect(counts.get("p1:directPaymentCash")).toBe(1);
      expect(counts.get("p1:withholdingPayment")).toBe(1);
    });

    it("names every counterpart in parties, with pseudonymised names", () => {
      const ids = new Set(
        seed.parties.map((p) => {
          return `${p.kind}:${p.id}`;
        }),
      );

      for (const entry of seed.entries) {
        for (const posting of entry.postings) {
          if (posting.counterpart !== null) {
            expect(
              ids.has(`${posting.counterpart.kind}:${posting.counterpart.id}`),
            ).toBe(true);
          }
        }
      }

      expect(
        seed.parties.find((p) => {
          return p.kind === "owner" && p.unitCode === "A01";
        })?.name,
      ).toBe("Morandini Dina");
    });

    it("is what the committed module holds", () => {
      expect(seed).toEqual(legacySeedData);
    });

    let db: Db;
    let seed: ReturnType<typeof projectLegacySeed>;
  },
);
