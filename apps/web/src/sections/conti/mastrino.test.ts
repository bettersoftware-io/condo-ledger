import { describe, it, expect } from "vitest";
import { mastrino } from "./mastrino";
import { ledgerTxnsByPeriod } from "../../mock/fixtures";
import type { LedgerTxnRow } from "@cl/application";

describe("mastrino", () => {
  it("extracts an account's entries with a running saldo", () => {
    const rows = mastrino(ledgerTxnsByPeriod["sat-2011"]!, "banca");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: "2011-04-02", description: "Incasso rata A02 Mauri",
    });
    expect(rows[0]!.dare.cents).toBe(100000);
    expect(rows[0]!.saldo.cents).toBe(100000); // running: 0 + 100000 - 0
  });
  it("accumulates saldo across multiple entries in date order", () => {
    const txns: LedgerTxnRow[] = [
      { id: "a", date: "2011-02-01", code: 2, description: "B", dare: { cents: 0 }, avere: { cents: 0 },
        entries: [{ accountId: "x", account: "X", dare: { cents: 0 }, avere: { cents: 300 } }] },
      { id: "b", date: "2011-01-01", code: 1, description: "A", dare: { cents: 0 }, avere: { cents: 0 },
        entries: [{ accountId: "x", account: "X", dare: { cents: 1000 }, avere: { cents: 0 } }] },
    ];
    const rows = mastrino(txns, "x");
    expect(rows.map((r) => r.saldo.cents)).toEqual([1000, 700]); // sorted by date, then code
  });
  it("returns [] for an account with no movements", () => {
    expect(mastrino(ledgerTxnsByPeriod["sat-2011"]!, "erar")).toEqual([]);
  });
});
