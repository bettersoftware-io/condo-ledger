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
