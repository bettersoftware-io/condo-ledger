import { describe, expect, it } from "vitest";

import { must } from "#/support/must.ts";
import { createSmallSeed } from "#/testing/createSmallBooks.ts";

import { legacySeedData } from "./legacySeed.generated.ts";
import {
  type LegacySeed,
  type LegacySeedData,
  loadLegacySeed,
} from "./legacySeed.ts";

describe("loadLegacySeed", () => {
  it("brands every amount and keeps everything else as it is", () => {
    const data = asData(createSmallSeed());

    expect(loadLegacySeed(data)).toEqual(createSmallSeed());
  });

  it("refuses a fractional amount, naming it", () => {
    const data = asData(createSmallSeed());
    must(must(data.entries[0], "an entry").postings[0], "a posting").debit =
      1.5;

    expect(() => {
      return loadLegacySeed(data);
    }).toThrow("not an integer amount of cents: 1.5");
  });

  it("refuses a fractional starting balance, naming it", () => {
    const data = asData(createSmallSeed());
    must(data.parties[0], "a period's parties").parties.push({
      kind: "owner",
      id: "r9",
      personId: "md19",
      name: "Neri Ugo",
      unitCode: "C01",
      startingBalance: 0.5,
      role: "PR",
      restriction: null,
    });

    expect(() => {
      return loadLegacySeed(data);
    }).toThrow("not an integer amount of cents: 0.5");
  });

  it("refuses a fractional rate, naming it", () => {
    const data = asData(createSmallSeed());
    data.withholdingTaxes.push({
      periodId: "p1",
      code: "1019",
      name: "Società di persone",
      rate: 4.5,
      accountId: "la7",
    });

    expect(() => {
      return loadLegacySeed(data);
    }).toThrow("not a rate: 4.5");
  });

  it("loads the generated seed: two buildings with books, each with one period", () => {
    const seed = loadLegacySeed(legacySeedData);

    expect(
      seed.buildings.map((building) => {
        return [building.name, building.periods.length];
      }),
    ).toEqual([
      ["Saturno", 1],
      ["Pozzetto", 1],
    ]);
    expect(
      seed.accounts.filter((account) => {
        return account.periodId === "p36";
      }),
    ).toHaveLength(82);
    expect(
      seed.entries.filter((entry) => {
        return entry.periodId === "p36";
      }),
    ).toHaveLength(140);
  });
});

function asData(seed: LegacySeed): LegacySeedData {
  return JSON.parse(JSON.stringify(seed)) as LegacySeedData;
}
