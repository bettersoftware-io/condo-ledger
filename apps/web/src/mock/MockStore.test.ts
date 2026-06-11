import { describe, it, expect } from "vitest";
import type { Observable } from "rxjs";
import { MockStore } from "./MockStore";

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
  it("setCoefficient re-emits tables AND re-splits the riparto", () => {
    const s = new MockStore();
    s.setCoefficient("sat-2011", "t-prop", "u-a01", 500);
    const table = latest(s.distributionTables("sat-2011")).find((t) => t.id === "t-prop")!;
    expect(table.items.find((i) => i.unitId === "u-a01")!.coefficient).toBe(500);
    expect(table.items.find((i) => i.unitId === "u-a02")!.coefficient).toBe(687.5);
    const dist = latest(s.distribution("sat-2011", "estimate"));
    const a01 = dist.rows[0]!.children!.find((r) => r.unitId === "u-a01")!;
    const a02 = dist.rows[0]!.children!.find((r) => r.unitId === "u-a02")!;
    expect(a01.amounts["e-pul"]!.cents).toBe(50526); // 120000 split 500/687.5 (largest remainder)
    expect(a02.amounts["e-pul"]!.cents).toBe(69474);
    expect(a01.amounts["e-pul"]!.cents + a02.amounts["e-pul"]!.cents).toBe(120000);
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
