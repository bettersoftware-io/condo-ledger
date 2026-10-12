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
      expect(entries[1]).toMatchObject({
        id: "tx150",
        number: 2,
        // The dump's datetime as stored (UTC): the legacy journal shows it as 15:59, Rome time.
        at: "2013-01-10T14:59:29",
      });
      expect(
        onControls.every((p) => {
          return p.counterpart !== null;
        }),
      ).toBe(true);
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
