import { describe, expect, it } from "vitest";

import { parseDesignOracle } from "./designOracle.ts";

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
