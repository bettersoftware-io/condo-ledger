import { describe, it, expect } from "vitest";
import { fromCents } from "@cl/domain";
import type { LedgerAccountRow } from "@cl/application";
import { applyEntryDeltas } from "./balances";

const c = fromCents;
const tree: LedgerAccountRow[] = [
  { id: "tot", kind: "grouping", label: "Totale", dare: c(300), avere: c(100), saldo: c(200), preventivo: null,
    children: [
      { id: "cassa", kind: "regular", label: "Cassa", dare: c(200), avere: c(0), saldo: c(200), preventivo: null },
      { id: "banca", kind: "regular", label: "Banca", dare: c(100), avere: c(100), saldo: c(0), preventivo: null },
    ] },
];

describe("applyEntryDeltas", () => {
  it("updates the touched leaf and re-derives its ancestors", () => {
    const out = applyEntryDeltas(tree, [{ accountId: "cassa", dareCents: 50, avereCents: 0 }]);
    const tot = out[0];
    const cassa = tot.children![0];
    expect(cassa.dare.cents).toBe(250);
    expect(cassa.saldo.cents).toBe(250);
    expect(tot.dare.cents).toBe(350);
    expect(tot.saldo.cents).toBe(250);
  });
  it("leaves untouched subtrees referentially identical", () => {
    const out = applyEntryDeltas(tree, [{ accountId: "cassa", dareCents: 50, avereCents: 0 }]);
    expect(out[0].children![1]).toBe(tree[0].children![1]); // banca untouched
  });
  it("is the identity for unknown accounts", () => {
    expect(applyEntryDeltas(tree, [{ accountId: "nope", dareCents: 1, avereCents: 0 }])[0]).toBe(tree[0]);
  });
});
