import { describe, it, expect } from "vitest";
import type { LedgerAccountRow } from "@cl/application";
import * as fx from "./fixtures";

function checkRollups(rows: LedgerAccountRow[]): void {
  for (const r of rows) {
    if (r.children?.length) {
      const dare = r.children.reduce((a, c) => a + c.dare.cents, 0);
      const avere = r.children.reduce((a, c) => a + c.avere.cents, 0);
      expect.soft({ id: r.id, dare: r.dare.cents, avere: r.avere.cents })
        .toEqual({ id: r.id, dare, avere });
      checkRollups(r.children);
    }
    expect(r.saldo.cents).toBe(r.dare.cents - r.avere.cents);
  }
}

describe("fixture consistency", () => {
  it.each(Object.entries(fx.ledgerAccountsByPeriod))("%s account roll-ups sum", (_id, rows) => {
    checkRollups(rows);
    expect(rows[0]!.saldo.cents).toBe(0); // Totale balances
  });
  it.each(Object.entries(fx.ledgerTxnsByPeriod))("%s journal entries balance", (_id, txns) => {
    for (const t of txns) {
      const dare = t.entries.reduce((a, e) => a + e.dare.cents, 0);
      const avere = t.entries.reduce((a, e) => a + e.avere.cents, 0);
      expect(dare).toBe(avere);
      for (const e of t.entries) expect(e.accountId).toBeTruthy();
    }
  });
  it("seeds functional accounts and F24s for both periods", () => {
    for (const pid of ["sat-2011", "poz-2010"]) {
      expect(fx.functionalByPeriod[pid]).toMatchObject({ liquid: expect.any(String) });
      expect(fx.f24sByPeriod[pid]!.length).toBeGreaterThan(0);
      expect(fx.detailByPeriod[pid]!.publicDocs.length).toBeGreaterThan(0);
    }
  });
});

describe("calendar fixtures", () => {
  it("event ids are unique and every event references a known layer", () => {
    const ids = fx.calendarEvents.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of fx.calendarEvents)
      expect(fx.calendarLayers.some((l) => l.id === e.layerId), e.id).toBe(true);
  });
  it("every F24 deadline has a calendar event on the same date and period", () => {
    for (const [periodId, rows] of Object.entries(fx.f24sByPeriod))
      for (const f of rows)
        expect(
          fx.calendarEvents.some((e) => e.date === f.scadenza && e.periodId === periodId),
          `${periodId} ${f.scadenza}`,
        ).toBe(true);
  });
  it("every installment expiry has a calendar event on the same date and period", () => {
    for (const [periodId, inst] of Object.entries(fx.installmentsByPeriod))
      for (const col of inst.columns) {
        expect(col.expiry, `${periodId} ${col.id} needs an expiry`).toBeTruthy();
        expect(
          fx.calendarEvents.some((e) => e.date === col.expiry && e.periodId === periodId),
          `${periodId} ${col.expiry}`,
        ).toBe(true);
      }
  });
});
