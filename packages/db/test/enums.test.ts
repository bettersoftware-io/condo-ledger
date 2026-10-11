import { describe, it, expect } from "vitest";
import * as enums from "../src/enums.ts";

describe("enums", () => {
  it("ledgerAccountType has the 4 legacy values in order", () => {
    expect(enums.ledgerAccountType.enumValues).toEqual([
      "regular", "grouping", "control", "controlUnitResident",
    ]);
  });
  it("ledgerTransactionType has all 10 legacy values", () => {
    expect(enums.ledgerTransactionType.enumValues).toHaveLength(10);
    expect(enums.ledgerTransactionType.enumValues).toContain("estimateDistribution");
  });
  it("installmentItemStatus and installmentPaymentSlipStatus are DISTINCT types", () => {
    expect(enums.installmentItemStatus.enumValues).toContain("incomplete");
    expect(enums.installmentPaymentSlipStatus.enumValues).not.toContain("incomplete");
  });
  it("defines exactly 23 enum types", () => {
    // drizzle's pgEnum() returns a callable column-builder that also carries an
    // .enumValues array, so detect by that property (it is a function, not a
    // plain object). The assertion guards against accidental dupes/omissions.
    const pgEnums = Object.values(enums).filter(
      (e: any) => {return typeof e === "function" && Array.isArray(e.enumValues)},
    );
    expect(pgEnums).toHaveLength(23);
  });
});
