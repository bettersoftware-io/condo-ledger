import { describe, expect, it } from "vitest";

import { dareAvereSaldo, eur } from "./amounts.ts";

describe("amounts", () => {
  it("parses legacy decimal strings to integer-cent Money", () => {
    expect(eur("12.50")).toEqual({ cents: 1250 });
    expect(eur("-44.20")).toEqual({ cents: -4420 });
    expect(eur(null)).toEqual({ cents: 0 });
  });
  it("splits signed amounts into dare/avere/saldo (cents)", () => {
    expect(dareAvereSaldo([50000, -20000, -30000])).toEqual({
      dare: 50000,
      avere: 50000,
      saldo: 0,
    });
    expect(dareAvereSaldo([12550, -4420])).toEqual({
      dare: 12550,
      avere: 4420,
      saldo: 8130,
    });
  });
});
