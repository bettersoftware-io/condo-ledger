import { describe, it, expect } from "vitest";
import { computeInstallments } from "./computeInstallments.ts";
import type { InstallmentPlan } from "./periodTypes.ts";

describe("computeInstallments", () => {
  it("splits each resident's estimate evenly across installments (residual to last via allocate)", () => {
    const est = new Map<string, number>([["r1", 100]]); // 100 cents / 3 → 34,33,33
    const out = computeInstallments(est, plan());
    const cells = out.get("r1")!;
    expect(cells.get("i1")).toBe(34);
    expect(cells.get("i2")).toBe(33);
    expect(cells.get("i3")).toBe(33);
    expect([...cells.values()].reduce((a, b) => {return a + b}, 0)).toBe(100);
  });

  it("conserves: Σ cells equals the resident estimate for arbitrary totals", () => {
    const est = new Map<string, number>([["r1", 99901], ["r2", 1]]);
    const out = computeInstallments(est, plan());

    for (const [rid, cents] of est) {
      expect([...out.get(rid)!.values()].reduce((a, b) => {return a + b}, 0)).toBe(cents);
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
    expect([...cells.values()].reduce((a, b) => {return a + b}, 0)).toBe(300);
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

  it("places the residual cent on an odd override delta exactly like the app's allocate", () => {
    const est = new Map<string, number>([["r1", 300]]); // even → 100,100,100
    // pin i1 to 125: delta = 100 − 125 = −25; allocate(−25,[1,1]) = −[13,12] = [−13,−12]
    // → later [100,100] + [−13,−12] = [87,88] (residual lands on the FIRST later cell, as in the app)
    const out = computeInstallments(est, plan([{ residentId: "r1", installmentId: "i1", cents: 125 }]));
    const cells = out.get("r1")!;
    expect(cells.get("i1")).toBe(125);
    expect(cells.get("i2")).toBe(87);
    expect(cells.get("i3")).toBe(88);
    expect([...cells.values()].reduce((a, b) => {return a + b}, 0)).toBe(300);
  });

  it("applies multiple overrides on one resident in installment order, each against running amounts", () => {
    const est = new Map<string, number>([["r1", 300]]); // even → 100,100,100
    // i1→120: delta −20 over [100,100] → [90,90]; amounts [120,90,90]
    // then i2→100: delta = 90 − 100 = −10 over [90] (i3) → [80]; amounts [120,100,80]
    const out = computeInstallments(
      est,
      plan([
        { residentId: "r1", installmentId: "i2", cents: 100 }, // deliberately out of order in input
        { residentId: "r1", installmentId: "i1", cents: 120 },
      ]),
    );
    const cells = out.get("r1")!;
    expect(cells.get("i1")).toBe(120);
    expect(cells.get("i2")).toBe(100);
    expect(cells.get("i3")).toBe(80);
    expect([...cells.values()].reduce((a, b) => {return a + b}, 0)).toBe(300);
  });

  it("treats a last-cell override as a no-op (preserves the Σ-cells == estimate invariant)", () => {
    const est = new Map<string, number>([["r1", 300]]); // even → 100,100,100
    const out = computeInstallments(est, plan([{ residentId: "r1", installmentId: "i3", cents: 150 }]));
    const cells = out.get("r1")!;
    expect(cells.get("i1")).toBe(100);
    expect(cells.get("i2")).toBe(100);
    expect(cells.get("i3")).toBe(100); // unchanged — last-cell edit ignored
  });

  it("ignores an override whose installmentId is not in the plan", () => {
    const est = new Map<string, number>([["r1", 300]]);
    const out = computeInstallments(est, plan([{ residentId: "r1", installmentId: "iX", cents: 999 }]));
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

function plan(overrides: InstallmentPlan["overrides"] = []): InstallmentPlan {
  return {
    installmentIds: ["i1", "i2", "i3"],
    overrides,
  };
}
