import { describe, it, expect } from "vitest";
import { projectAccounts, projectTransactions } from "./accounting.ts";
import { buildDb } from "../db.ts";
import type { Tables } from "../loadRows.ts";

// account 1 (grouping) > [2 regular bank, 3 regular expense(estimate 200.00)]
const tables: Tables = {
  ledgerAccount: [
    { id: "1", accountingPeriodId: "1", name: "Totale", type: "grouping", parentLedgerAccountId: null, kind: "assetsOrLiabilities", order: "1" },
    { id: "2", accountingPeriodId: "1", name: "Banca", type: "regular", parentLedgerAccountId: "1", kind: "assets", order: "1" },
    { id: "3", accountingPeriodId: "1", name: "Pulizie", type: "regular", parentLedgerAccountId: "1", kind: "expenses", order: "2", periodRestrictionStartDate: null, periodRestrictionEndDate: null },
  ],
  expenseLedgerAccount: [{ ledgerAccountId: "3", estimate: "200.00", restrictionUnitGroupId: null }],
  ledgerTransaction: [{ id: "9", accountingPeriodId: "1", code: "1", type: "checkingAccountDirectPayment", timestamp: "2011-03-13 13:07:00", description: "Bolletta", ledgerInvoiceId: null }],
  ledgerEntry: [
    { id: "21", ledgerTransactionId: "9", postingAccountId: "3", amount: "120.00", order: "1", type: null, unitResidentId: null, masterDataId: null },
    { id: "22", ledgerTransactionId: "9", postingAccountId: "2", amount: "-120.00", order: "2", type: null, unitResidentId: null, masterDataId: null },
  ],
};

describe("accounting projection", () => {
  it("builds the account tree with rolled-up dare/avere/saldo and expense preventivo", () => {
    const tree = projectAccounts(db, "1");
    const tot = tree[0]!;
    expect(tot).toMatchObject({ id: "la1", kind: "grouping", label: "Totale" });
    expect(tot.dare).toEqual({ cents: 12000 });
    expect(tot.avere).toEqual({ cents: 12000 });
    expect(tot.saldo).toEqual({ cents: 0 });
    const pulizie = tot.children!.find((c) => {return c.id === "la3"})!;
    expect(pulizie.preventivo).toEqual({ cents: 20000 });
    expect(pulizie.saldo).toEqual({ cents: 12000 });
    const banca = tot.children!.find((c) => {return c.id === "la2"})!;
    expect(banca.preventivo).toBeNull();
  });
  it("builds transactions with per-entry dare/avere and a header total", () => {
    const txns = projectTransactions(db, "1");
    expect(txns[0]).toMatchObject({ id: "tx9", code: 1, description: "Bolletta", date: "2011-03-13" });
    expect(txns[0]!.dare).toEqual({ cents: 12000 });
    expect(txns[0]!.entries.map((e) => {return e.account})).toEqual(["Pulizie", "Banca"]);
    expect(txns[0]!.entries[0]).toMatchObject({ accountId: "la3", dare: { cents: 12000 }, avere: { cents: 0 } });
    expect(txns[0]!.entries[1]).toMatchObject({ accountId: "la2", dare: { cents: 0 }, avere: { cents: 12000 } });
  });

  const db = buildDb(tables);
});
