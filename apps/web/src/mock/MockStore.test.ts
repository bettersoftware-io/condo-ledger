import { describe, it, expect } from "vitest";
import type { Observable } from "rxjs";
import { MockStore } from "./MockStore";
import { generatedSeed } from "./data.generated";

const latest = <T,>(obs: Observable<T>): T => {
  let v!: T;
  obs.subscribe((x) => { v = x; }).unsubscribe();
  return v;
};

describe("MockStore reads", () => {
  it("serves the fixture tree and per-period collections", () => {
    const s = new MockStore();
    expect(latest(s.condominiumTree()).map((n) => n.id)).toEqual(["poz", "sat"]);
    expect(latest(s.unitsTree("sat-2011"))[0]!.id).toBe("g-sat");
    expect(latest(s.unitsTree("unknown"))).toEqual([]);
    expect(latest(s.condominiumDetail("unknown"))).toBeNull();
    expect(latest(s.installments("poz-2010")).columns).toHaveLength(2);
  });
  it("re-emits on subject change (reactive reads)", () => {
    class TestStore extends MockStore {
      clearTxns(periodId: string): void {
        this.patch(this.txns$, periodId, [], () => []);
      }
    }
    const s = new TestStore();
    const seen: number[] = [];
    const sub = s.ledgerTransactions("sat-2011").subscribe((t) => seen.push(t.length));
    expect(seen).toEqual([3]);
    s.clearTxns("sat-2011");
    expect(seen).toEqual([3, 0]);
    sub.unsubscribe();
  });
});

describe("MockStore inline-edit commands", () => {
  it("setCoefficient re-emits the coefficient table (fixture seed)", () => {
    const s = new MockStore();
    s.setCoefficient("sat-2011", "t-prop", "u-a01", 500);
    const table = latest(s.distributionTables("sat-2011")).find((t) => t.id === "t-prop")!;
    expect(table.items.find((i) => i.unitId === "u-a01")!.coefficient).toBe(500);
    expect(table.items.find((i) => i.unitId === "u-a02")!.coefficient).toBe(687.5);
  });

  it("setCoefficient re-splits the riparto via the cascade (generated seed), preserving column totals", () => {
    const seed = generatedSeed;
    const states = seed.periodStateByPeriod ?? {};
    // a book period with a coefficient table carrying >= 2 items
    const pid = Object.keys(states).find((p) =>
      states[p]!.riparto.unitLegacyIds.length > 1 &&
      (seed.distributionTablesByPeriod[p] ?? []).some((t) => t.items.length >= 2))!;
    expect(pid).toBeTruthy();
    const s = new MockStore(seed);
    const table = (seed.distributionTablesByPeriod[pid] ?? []).find((t) => t.items.length >= 2)!;
    const before = latest(s.distribution(pid, "estimate"));
    const col = before.rows[0]!; // group row
    const colTotalsBefore = Object.fromEntries(Object.entries(col.amounts).map(([k, v]) => [k, v.cents]));
    // bump the first item's coefficient
    const first = table.items[0]!;
    s.setCoefficient(pid, table.id, first.unitId, first.coefficient + 100);
    const after = latest(s.distribution(pid, "estimate"));
    const colAfter = after.rows[0]!;
    // group/column totals are conserved within 1 cent (largest-remainder rounding may shift by 1)
    for (const k of Object.keys(colTotalsBefore)) {
      expect(Math.abs(colAfter.amounts[k]!.cents - colTotalsBefore[k]!)).toBeLessThanOrEqual(1);
    }
    // and at least one unit cell actually changed
    expect(JSON.stringify(after.rows)).not.toBe(JSON.stringify(before.rows));
  });
  it("setPreventivo updates the account row", () => {
    const s = new MockStore();
    s.setPreventivo("sat-2011", "cassa", 99900);
    const rows = latest(s.ledgerAccountsTree("sat-2011"));
    const find = (rs: typeof rows, id: string): (typeof rows)[number] | null => {
      for (const r of rs) { if (r.id === id) return r; const hit = r.children ? find(r.children, id) : null; if (hit) return hit; }
      return null;
    };
    expect(find(rows, "cassa")!.preventivo!.cents).toBe(99900);
  });
  it("setInstallmentAmount redistributes later rate and re-derives the group row", () => {
    const s = new MockStore();
    s.setInstallmentAmount("sat-2011", "i-a01", "r1", 40000); // was 49576
    const data = latest(s.installments("sat-2011"));
    const a01 = data.rows[0]!.children!.find((r) => r.id === "i-a01")!;
    expect(a01.byInstallment.r1!.cents).toBe(40000);
    // delta 9576 spread over r2/r3: 4788 each
    expect(a01.byInstallment.r2!.cents).toBe(49576 + 4788);
    expect(a01.byInstallment.r3!.cents).toBe(49575 + 4788);
    expect(data.rows[0]!.byInstallment.r1!.cents).toBe(40000 + 71608); // group re-derived
  });
  it("setInstallmentAmount flags the edited cell as overridden", () => {
    const s = new MockStore();
    s.setInstallmentAmount("sat-2011", "i-a01", "r1", 40000);
    const a01 = latest(s.installments("sat-2011")).rows[0]!.children!.find((r) => r.id === "i-a01")!;
    expect(a01.overridden).toEqual({ r1: true });
  });
  it("setInstallmentAmount throws on rejection and leaves state unchanged", () => {
    const s = new MockStore();
    s.setInstallmentAmount("sat-2011", "i-a01", "r1", 40000); // valid edit first
    const before = latest(s.installments("sat-2011"));
    expect(() => s.setInstallmentAmount("sat-2011", "i-a01", "r2", 99999999)).toThrow(/negative/);
    // state must be unchanged after the throw
    expect(latest(s.installments("sat-2011"))).toBe(before);
    const a01 = before.rows[0]!.children!.find((r) => r.id === "i-a01")!;
    expect(a01.byInstallment.r2!.cents).toBe(49576 + 4788); // unchanged
  });
  it("setInstallmentAmount identity edit does not throw and does not set the overridden flag", () => {
    const s = new MockStore();
    const before = latest(s.installments("sat-2011"));
    const r1Current = before.rows[0]!.children!.find((r) => r.id === "i-a01")!.byInstallment.r1!.cents;
    expect(() => s.setInstallmentAmount("sat-2011", "i-a01", "r1", r1Current)).not.toThrow();
    const a01 = latest(s.installments("sat-2011")).rows[0]!.children!.find((r) => r.id === "i-a01")!;
    expect(a01.overridden?.r1).toBeUndefined(); // identity edit must not set overridden
  });
  it("setInstallmentAmount is a no-op for an unknown installment id", () => {
    const s = new MockStore();
    const before = latest(s.installments("sat-2011"));
    s.setInstallmentAmount("sat-2011", "i-a01", "nope", 40000);
    expect(latest(s.installments("sat-2011"))).toBe(before);
  });
  it("two stores do not share state", () => {
    const a = new MockStore();
    const b = new MockStore();
    a.setPreventivo("sat-2011", "cassa", 11111);
    const rows = latest(b.ledgerAccountsTree("sat-2011"));
    expect(JSON.stringify(rows)).not.toContain("11111");
  });
});

describe("createInstallments", () => {
  it("builds N rate columns from the coefficient table, totals preserved", () => {
    const s = new MockStore();
    s.createInstallments("sat-2011", {
      count: 4, firstExpiry: "2011-02-01", cadenceMonths: 3, totalCents: 380000, tableId: "t-prop",
    });
    const data = latest(s.installments("sat-2011"));
    expect(data.columns.map((c) => c.header)).toEqual([
      "Rata 1 (01/02/2011)", "Rata 2 (01/05/2011)", "Rata 3 (01/08/2011)", "Rata 4 (01/11/2011)",
    ]);
    const group = data.rows[0]!;
    const grand = data.columns.reduce((a, c) => a + group.byInstallment[c.id]!.cents, 0);
    expect(grand).toBe(380000);
    expect(group.children).toHaveLength(2); // one row per coefficient item
  });
  it("throws for an unknown table", () => {
    const s = new MockStore();
    expect(() => s.createInstallments("sat-2011", {
      count: 2, firstExpiry: "2011-01-01", cadenceMonths: 1, totalCents: 100, tableId: "nope",
    })).toThrow(/[Tt]abella/);
  });
});

describe("MockStore CRUD commands", () => {
  it("condominium add/edit/remove and addPeriod", () => {
    const s = new MockStore();
    s.addCondominium({ id: "new", code: "NEW", name: "Nuovo", type: "regular", periods: [] });
    s.addPeriod("new", { id: "new-2012", name: "2012 (Ordinario)", type: "ordinary", closed: false, start: "2012-01-01", end: "2012-12-31" });
    s.editCondominium("new", { name: "Nuovo Rinominato" });
    let tree = latest(s.condominiumTree());
    const node = tree.find((n) => n.id === "new")!;
    expect(node.name).toBe("Nuovo Rinominato");
    expect(node.periods).toHaveLength(1);
    s.removeCondominium("new");
    tree = latest(s.condominiumTree());
    expect(tree.find((n) => n.id === "new")).toBeUndefined();
  });
  it("supplier add/remove on the period detail", () => {
    const s = new MockStore();
    s.addSupplier("sat-2011", { id: "s9", nominativo: "Idraulica Blu", categoria: "Idraulico" });
    expect(latest(s.condominiumDetail("sat-2011"))!.suppliers.map((x) => x.id)).toContain("s9");
    s.removeSupplier("sat-2011", "s9");
    expect(latest(s.condominiumDetail("sat-2011"))!.suppliers.map((x) => x.id)).not.toContain("s9");
  });
  it("unit-tree add/edit/remove", () => {
    const s = new MockStore();
    const zero = { cents: 0 };
    s.addUnitRow("sat-2011", "u-a01", {
      id: "r-new", kind: "resident", label: "Nuovo Residente (PR 100%)",
      saldoPrec: zero, preventivo: zero, consuntivo: zero, totDovuto: zero, versato: zero,
    });
    expect(JSON.stringify(latest(s.unitsTree("sat-2011")))).toContain("r-new");
    s.editUnitRow("sat-2011", "r-new", { label: "Residente Rinominato" });
    expect(JSON.stringify(latest(s.unitsTree("sat-2011")))).toContain("Residente Rinominato");
    s.removeUnitRow("sat-2011", "r-new");
    expect(JSON.stringify(latest(s.unitsTree("sat-2011")))).not.toContain("r-new");
  });
  it("table + item CRUD and account-tree CRUD", () => {
    const s = new MockStore();
    s.addTable("sat-2011", { id: "t-new", name: "Acqua", restriction: null, total: 1000, items: [] });
    s.addTableItem("sat-2011", "t-new", { unitId: "u-a01", unitLabel: "A01", coefficient: 1000, competenza: "intero" });
    expect(latest(s.distributionTables("sat-2011")).find((t) => t.id === "t-new")!.items).toHaveLength(1);
    s.removeTableItem("sat-2011", "t-new", "u-a01");
    s.editTable("sat-2011", "t-new", { name: "Acqua Fredda" });
    expect(latest(s.distributionTables("sat-2011")).find((t) => t.id === "t-new")!.name).toBe("Acqua Fredda");
    s.removeTable("sat-2011", "t-new");
    expect(latest(s.distributionTables("sat-2011")).find((t) => t.id === "t-new")).toBeUndefined();

    const zero = { cents: 0 };
    s.addAccountRow("sat-2011", "liq", { id: "posta", kind: "regular", label: "C/C Postale", dare: zero, avere: zero, saldo: zero, preventivo: null });
    expect(JSON.stringify(latest(s.ledgerAccountsTree("sat-2011")))).toContain("C/C Postale");
    s.editAccountRow("sat-2011", "posta", { label: "Conto BancoPosta" });
    s.removeAccountRow("sat-2011", "posta");
    expect(JSON.stringify(latest(s.ledgerAccountsTree("sat-2011")))).not.toContain("posta");
  });
});

describe("MockStore transaction commands", () => {
  it("addTransaction appends a balanced txn and applies balance deltas", () => {
    const s = new MockStore();
    s.addTransaction("sat-2011", {
      date: "2011-05-01", description: "Prova scrittura",
      entries: [
        { accountId: "cassa", label: "Cassa Contanti", dareCents: 1000, avereCents: 0 },
        { accountId: "banca", label: "Banca", dareCents: 0, avereCents: 1000 },
      ],
    });
    const txns = latest(s.ledgerTransactions("sat-2011"));
    expect(txns).toHaveLength(4);
    expect(txns[3]!.code).toBe(4);
    expect(txns[3]!.dare.cents).toBe(1000);
    const cassa = JSON.stringify(latest(s.ledgerAccountsTree("sat-2011")));
    expect(cassa).toContain('"cents":' + (13552 + 1000)); // cassa dare bumped
  });
  it("addTransaction rejects unbalanced entries", () => {
    const s = new MockStore();
    expect(() => s.addTransaction("sat-2011", {
      date: "2011-05-01", description: "Sbilanciata",
      entries: [{ accountId: "cassa", label: "Cassa", dareCents: 10, avereCents: 0 }],
    })).toThrow(/bilanciata/);
  });
  it("registerInvoice posts gross to expense, net to payable, ritenuta to its account", () => {
    const s = new MockStore();
    s.registerInvoice("sat-2011", {
      date: "2011-06-01", supplierName: "Acme", invoiceNumber: "F-77",
      grossCents: 50000, withholdingCents: 10000,
      expenseAccountId: "cassa", expenseAccountLabel: "Pulizie",        // fixture leaf ids suffice
      payableAccountId: "banca", payableAccountLabel: "Fornitori",
      withholdingAccountId: "banca", withholdingAccountLabel: "Erario c/ritenute",
    });
    const txns = latest(s.ledgerTransactions("sat-2011"));
    const inv = txns[txns.length - 1]!;
    expect(inv.description).toContain("F-77");
    expect(inv.entries.map((e) => [e.dare.cents, e.avere.cents])).toEqual([
      [50000, 0], [0, 40000], [0, 10000],
    ]);
  });
  it("recordTaking throws for an unknown resident, posting nothing", () => {
    const s = new MockStore();
    expect(() => s.recordTaking("sat-2011", {
      date: "2011-07-01", residentId: "nope", residentLabel: "Nessuno",
      liquidAccountId: "banca", liquidAccountLabel: "Banca",
      creditAccountId: "cassa", creditAccountLabel: "Condòmini c/rate",
      settlements: [{ installmentId: "r1", amountCents: 100 }],
    })).toThrow(/inesistente/);
    expect(latest(s.ledgerTransactions("sat-2011"))).toHaveLength(3); // nothing posted
  });
  it("recordTaking posts the incasso and bumps versato on resident + ancestors", () => {
    const s = new MockStore();
    s.recordTaking("sat-2011", {
      date: "2011-07-01", residentId: "r-a01-1", residentLabel: "Alberi Dina",
      liquidAccountId: "banca", liquidAccountLabel: "Banca",
      creditAccountId: "cassa", creditAccountLabel: "Condòmini c/rate",
      settlements: [{ installmentId: "r1", amountCents: 49576 }],
    });
    const units = latest(s.unitsTree("sat-2011"));
    expect(units[0]!.versato.cents).toBe(49576);                       // group rollup
    expect(units[0]!.children![0]!.versato.cents).toBe(49576);          // unit u-a01
    expect(units[0]!.children![0]!.children![0]!.versato.cents).toBe(49576); // resident
    expect(units[0]!.children![1]!.versato.cents).toBe(0);              // untouched sibling
  });
});

describe("periodSummaries derivation", () => {
  it("periodSummaries re-derives when a transaction lands", () => {
    const s = new MockStore();
    expect(latest(s.periodSummaries())["sat-2011"]!.liquidita.cents).toBe(51841);
    s.addTransaction("sat-2011", {
      date: "2011-09-01", description: "Versamento in cassa",
      entries: [
        { accountId: "cassa", label: "Cassa", dareCents: 1000, avereCents: 0 },
        { accountId: "crate", label: "Condòmini c/rate", dareCents: 0, avereCents: 1000 },
      ],
    });
    expect(latest(s.periodSummaries())["sat-2011"]!.liquidita.cents).toBe(52841);
  });
});

describe("editAccountRow expense-flag clearing", () => {
  it("editAccountRow clears expense fields when patch sets them undefined/null", () => {
    const s = new MockStore();
    s.editAccountRow("sat-2011", "e-pul", { rd: undefined, tabelle: undefined, preventivo: null });
    const rows = latest(s.ledgerAccountsTree("sat-2011"));
    const find = (rs: typeof rows, id: string): (typeof rows)[number] | null => {
      for (const r of rs) { if (r.id === id) return r; const hit = r.children ? find(r.children, id) : null; if (hit) return hit; }
      return null;
    };
    const epul = find(rows, "e-pul")!;
    expect(epul.rd).toBeUndefined();
    expect(epul.tabelle).toBeUndefined();
    expect(epul.preventivo).toBeNull();
  });
});

describe("Plan 2 store extensions", () => {
  it("serves and mutates F24s per period", () => {
    const s = new MockStore();
    expect(latest(s.f24s("sat-2011")).map((f) => f.id)).toEqual(["f24-1", "f24-2"]);
    s.addF24("sat-2011", { id: "f24-9", descrizione: "Nuovo F24", scadenza: "2011-10-16", importo: { cents: 5000 }, stato: "da pagare" });
    s.editF24("sat-2011", "f24-9", { stato: "pagato" });
    expect(latest(s.f24s("sat-2011")).find((f) => f.id === "f24-9")!.stato).toBe("pagato");
  });
  it("serves and updates functional accounts", () => {
    const s = new MockStore();
    expect(latest(s.functionalAccounts("sat-2011")).payable).toBe("forn");
    s.setFunctionalAccount("sat-2011", "payable", "erar");
    expect(latest(s.functionalAccounts("sat-2011")).payable).toBe("erar");
  });
  it("payWithholding posts dare-withholding / avere-liquid", () => {
    const s = new MockStore();
    s.payWithholding("sat-2011", {
      date: "2011-04-16", amountCents: 10000,
      withholdingAccountId: "erar", withholdingAccountLabel: "Erario c/ritenute",
      liquidAccountId: "banca", liquidAccountLabel: "Banca",
    });
    const txns = latest(s.ledgerTransactions("sat-2011"));
    const last = txns[txns.length - 1]!;
    expect(last.description).toContain("ritenuta");
    expect(last.entries.map((e) => [e.accountId, e.dare.cents, e.avere.cents]))
      .toEqual([["erar", 10000, 0], ["banca", 0, 10000]]);
  });
  it("editInstallment patches a rata column (lock + header)", () => {
    const s = new MockStore();
    s.editInstallment("sat-2011", "r1", { locked: true, header: "Rata 1 (31/01/2011)" });
    const { columns } = latest(s.installments("sat-2011"));
    expect(columns.find((c) => c.id === "r1")).toMatchObject({ locked: true, header: "Rata 1 (31/01/2011)" });
  });
  it("addTransaction throws for an unknown accountId, posting nothing", () => {
    const s = new MockStore();
    expect(() => s.addTransaction("sat-2011", {
      date: "2011-05-01", description: "Conto fantasma",
      entries: [
        { accountId: "ghost", label: "Fantasma", dareCents: 100, avereCents: 0 },
        { accountId: "cassa", label: "Cassa", dareCents: 0, avereCents: 100 },
      ],
    })).toThrow(/Conto inesistente: ghost/);
    expect(latest(s.ledgerTransactions("sat-2011"))).toHaveLength(3);
  });
});

describe("calendar slice", () => {
  it("serves layers and events from fixtures", () => {
    const s = new MockStore();
    expect(latest(s.calendarLayers()).map((l) => l.id))
      .toEqual(["lay-scad", "lay-assem", "lay-manut", "lay-studio"]);
    expect(latest(s.calendarEvents()).some((e) => e.id === "ev-assem-sat")).toBe(true);
  });
  it("addCalendarEvent appends and re-emits", () => {
    const s = new MockStore();
    const seen: number[] = [];
    const sub = s.calendarEvents().subscribe((e) => seen.push(e.length));
    s.addCalendarEvent({ id: "ev-x", date: "2011-04-09", description: "Sopralluogo tetto",
      layerId: "lay-manut", status: "new", priority: "low" });
    sub.unsubscribe();
    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(seen[0]! + 1);
  });
  it("addCalendarEvent rejects an unknown layer and leaves state untouched", () => {
    const s = new MockStore();
    const before = latest(s.calendarEvents()).length;
    expect(() => s.addCalendarEvent({ id: "ev-bad", date: "2011-04-09", description: "X",
      layerId: "lay-nope", status: "new", priority: "low" })).toThrow("Calendario sconosciuto");
    expect(latest(s.calendarEvents())).toHaveLength(before);
  });
  it("editCalendarEvent merges the patch and keeps the competenza link", () => {
    const s = new MockStore();
    s.editCalendarEvent("ev-assem-sat", { description: "Assemblea straordinaria", status: "cancelled" });
    const e = latest(s.calendarEvents()).find((x) => x.id === "ev-assem-sat")!;
    expect(e.description).toBe("Assemblea straordinaria");
    expect(e.status).toBe("cancelled");
    expect(e.periodId).toBe("sat-2011"); // patch without periodId must not drop it
  });
  it("removeCalendarEvent drops the event", () => {
    const s = new MockStore();
    s.removeCalendarEvent("ev-ferie");
    expect(latest(s.calendarEvents()).some((e) => e.id === "ev-ferie")).toBe(false);
  });
});

describe("anagrafiche slice", () => {
  it("serves the fixture registry and the static categories", () => {
    const s = new MockStore();
    expect(latest(s.anagrafiche())).toHaveLength(23);
    expect(latest(s.anagraficaCategories())).toContain("Istituto di credito");
  });
  it("addAnagrafica rejects an unknown categoria and leaves state untouched", () => {
    const s = new MockStore();
    expect(() => s.addAnagrafica({
      id: "ana-x", kind: "company", nominativo: "X", categoria: "Categoria inventata", stato: "active",
    })).toThrow("Categoria sconosciuta");
    expect(latest(s.anagrafiche())).toHaveLength(23);
  });
  it("add, edit and remove round-trip; edit merges without dropping fields", () => {
    const s = new MockStore();
    s.addAnagrafica({ id: "ana-zorzi", kind: "person", nominativo: "Zorzi Anna",
      categoria: "Condòmino", stato: "active", nome: "Anna", cognome: "Zorzi" });
    s.editAnagrafica("ana-zorzi", { professione: "Architetto" });
    const z = latest(s.anagrafiche()).find((a) => a.id === "ana-zorzi")!;
    expect(z.professione).toBe("Architetto");
    expect(z.nominativo).toBe("Zorzi Anna"); // merge preserves untouched fields
    s.removeAnagrafica("ana-zorzi");
    expect(latest(s.anagrafiche()).some((a) => a.id === "ana-zorzi")).toBe(false);
  });
  it("anagraficaLinks finds supplier and condòmino cross-references", () => {
    const s = new MockStore();
    // ana-bper: supplier of Saturno 2011 (detail fixture s3 has the same nominativo)
    expect(latest(s.anagraficaLinks("ana-bper"))).toEqual([{
      condominio: "Saturno", esercizio: "2011 (Ordinario)",
      ruolo: "Fornitore", dettaglio: "Istituto di credito",
    }]);
    // ana-alberi: resident in the Saturno unit tree
    const alberi = latest(s.anagraficaLinks("ana-alberi"));
    expect(alberi).toHaveLength(1);
    expect(alberi[0]).toMatchObject({ condominio: "Saturno", ruolo: "Condòmino" });
    expect(alberi[0]!.dettaglio).toContain("Alberi Dina");
    // Lloyd has no link anywhere; unknown ids yield []
    expect(latest(s.anagraficaLinks("ana-lloyd"))).toEqual([]);
    expect(latest(s.anagraficaLinks("nope"))).toEqual([]);
  });
});
