import { describe, it, expect } from "vitest";
import { legacyDb } from "./world.ts";
import {
  rawTrialBalanceCents, entryCount, estimateDistributionByResident, installmentItemTotalCents,
} from "./oracle.ts";

describe("legacy oracles", () => {
  it("trial balance nets to zero for the reconciling periods", () => {
    expect(Math.abs(rawTrialBalanceCents(db, "1"))).toBeLessThanOrEqual(1);
    expect(Math.abs(rawTrialBalanceCents(db, "36"))).toBeLessThanOrEqual(1);
  });
  it("the reconciling periods have posted entries", () => {
    expect(entryCount(db, "1")).toBeGreaterThan(0);
    expect(entryCount(db, "36")).toBeGreaterThan(0);
  });
  it("the legacy estimateDistribution postings exist per resident", () => {
    const m = estimateDistributionByResident(db, "36");
    expect(m.size).toBeGreaterThan(0);
    const total = [...m.values()].reduce((s, c) => {return s + c}, 0);
    expect(total).toBeGreaterThan(0);
  });
  it("installment items total to a positive amount", () => {
    expect(installmentItemTotalCents(db, "36")).toBeGreaterThan(0);
  });

  const db = legacyDb();
});
