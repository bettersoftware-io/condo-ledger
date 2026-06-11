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
    const dist = latest(s.distribution("sat-2011", "estimate"));
    const a01 = dist.rows[0]!.children!.find((r) => r.unitId === "u-a01")!;
    expect(a01.amounts["e-pul"]!.cents).toBe(60000); // 120000 split 500/500
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
  it("two stores do not share state", () => {
    const a = new MockStore();
    const b = new MockStore();
    a.setPreventivo("sat-2011", "cassa", 11111);
    const rows = latest(b.ledgerAccountsTree("sat-2011"));
    expect(JSON.stringify(rows)).not.toContain("11111");
  });
});
