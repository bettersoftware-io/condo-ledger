import { describe, expect, it } from "vitest";

import { parseDesignOracle } from "./designOracle.ts";

describe("parseDesignOracle", () => {
  it("reads the Italian amounts as cents, the fourth as the budget, and the rows under each", () => {
    const design = parseDesignOracle(
      JSON.stringify({
        id: "acc-1",
        label: "Totale",
        m: ["1.234,56", "234,56", "1.000,00", "3.800,00"],
        kids: [{ id: "acc-2", label: "Spese", m: ["-0,50", "0,00", "-0,5"] }],
      }),
    );

    expect(design).toEqual({
      id: "acc-1",
      label: "Totale",
      debit: 123456,
      credit: 23456,
      balance: 100000,
      budget: 380000,
      kids: [
        {
          id: "acc-2",
          label: "Spese",
          debit: -50,
          credit: 0,
          balance: -50,
          budget: null,
          kids: [],
        },
      ],
    });
  });
});

describe("parseDesignOracle refuses an amount it cannot read, naming the row", () => {
  it("refuses an empty amount, which Number() would read as zero", () => {
    expect(() => {
      return parseDesignOracle(json({ id: "acc-1", m: ["", "0,00", "0,00"] }));
    }).toThrow(`not an amount in the design's oracle: "" on acc-1`);
  });

  it("refuses an empty budget", () => {
    expect(() => {
      return parseDesignOracle(
        json({ id: "acc-2", m: ["1,00", "0,00", "1,00", " "] }),
      );
    }).toThrow(`not an amount in the design's oracle: " " on acc-2`);
  });

  it("refuses a row with fewer than three amounts", () => {
    expect(() => {
      return parseDesignOracle(json({ id: "acc-3", m: ["1,00", "0,00"] }));
    }).toThrow("missing: an amount of acc-3 in the design's oracle");
  });

  it("refuses an amount that is not a number", () => {
    expect(() => {
      return parseDesignOracle(json({ id: "acc-4", m: ["1,00", "n/a", "0"] }));
    }).toThrow(`not an amount in the design's oracle: "n/a" on acc-4`);
  });
});

interface RawRow {
  id: string;
  m: string[];
}

/** One childless row of the export, as JSON. */
function json(row: RawRow): string {
  return JSON.stringify({ ...row, label: "Totale" });
}
