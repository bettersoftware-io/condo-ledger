import { describe, it, expect } from "vitest";
import { computeInstallments } from "./computeInstallments";
import type { InstallmentPlan } from "./periodTypes";

const plan = (overrides: InstallmentPlan["overrides"] = []): InstallmentPlan => ({
  installmentIds: ["i1", "i2", "i3"],
  overrides,
});

describe("computeInstallments", () => {
  it("splits each resident's estimate evenly across installments (residual to last via allocate)", () => {
    const est = new Map<string, number>([["r1", 100]]); // 100 cents / 3 → 34,33,33
    const out = computeInstallments(est, plan());
    const cells = out.get("r1")!;
    expect(cells.get("i1")).toBe(34);
    expect(cells.get("i2")).toBe(33);
    expect(cells.get("i3")).toBe(33);
    expect([...cells.values()].reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("conserves: Σ cells equals the resident estimate for arbitrary totals", () => {
    const est = new Map<string, number>([["r1", 99901], ["r2", 1]]);
    const out = computeInstallments(est, plan());
    for (const [rid, cents] of est) {
      expect([...out.get(rid)!.values()].reduce((a, b) => a + b, 0)).toBe(cents);
    }
  });

  it("applies a valid override and spreads the delta across LATER cells (conserved)", () => {
    const est = new Map<string, number>([["r1", 300]]); // even → 100,100,100
    const out = computeInstallments(est, plan([{ residentId: "r1", installmentId: "i1", cents: 150 }]));
    const cells = out.get("r1")!;
    expect(cells.get("i1")).toBe(150); // pinned
    // delta −50 spread across later cells [i2,i3] via allocate(-50,[1,1]) = [-25,-25]
    expect(cells.get("i2")).toBe(75);
    expect(cells.get("i3")).toBe(75);
    expect([...cells.values()].reduce((a, b) => a + b, 0)).toBe(300);
  });

  it("ignores an override that would drive a later cell negative (keeps even split)", () => {
    const est = new Map<string, number>([["r1", 300]]); // even → 100,100,100
    // override i1 to 350: delta = 100 − 350 = −250; later [100,100] + allocate(−250,[1,1])=[−125,−125]
    // → projected [−25,−25] is negative → REJECT, resident keeps the even split
    const out = computeInstallments(est, plan([{ residentId: "r1", installmentId: "i1", cents: 350 }]));
    const cells = out.get("r1")!;
    expect(cells.get("i1")).toBe(100);
    expect(cells.get("i2")).toBe(100);
    expect(cells.get("i3")).toBe(100);
  });

  it("returns an empty plan map when there are no installments", () => {
    const est = new Map<string, number>([["r1", 100]]);
    const out = computeInstallments(est, { installmentIds: [], overrides: [] });
    expect(out.get("r1")!.size).toBe(0);
  });
});
