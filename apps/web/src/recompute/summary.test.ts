import { describe, it, expect } from "vitest";
import { periodSummary } from "./summary";
import { ledgerAccountsByPeriod, unitsByPeriod } from "../mock/fixtures";

describe("periodSummary", () => {
  it("derives the six Dati aggregates for sat-2011", () => {
    const s = periodSummary(ledgerAccountsByPeriod["sat-2011"]!, unitsByPeriod["sat-2011"]!);
    expect(s.liquidita.cents).toBe(51841);      // saldo of the "Liquidità" group
    expect(s.fondi.cents).toBe(-50000);          // saldo of "Fondi"
    expect(s.preventivo.cents).toBe(3800000);    // units root group
    expect(s.consuntivo.cents).toBe(3439865);
    expect(s.saldoPrec.cents).toBe(-625099);
    expect(s.totDovuto.cents).toBe(2814766);
  });
  it("falls back to cassa-like accounts when no Liquidità group exists (poz)", () => {
    const s = periodSummary(ledgerAccountsByPeriod["poz-2010"]!, unitsByPeriod["poz-2010"]!);
    expect(s.liquidita.cents).toBe(10000);       // "Cassa Contanti" leaf
    expect(s.fondi.cents).toBe(0);
  });
  it("returns zeros for empty inputs", () => {
    const s = periodSummary([], []);
    expect(s.preventivo.cents).toBe(0);
    expect(s.liquidita.cents).toBe(0);
  });
});
