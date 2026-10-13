// packages/domain/src/useCases/riparto/computeRiparto.test.ts
import { describe, expect, it } from "vitest";

import { must } from "#/support/must.ts";

import { buildRiparto } from "./computeRiparto.ts";
import type { RipartoInput } from "./types.ts";

describe("computeRiparto", () => {
  it("exposes one column for the linked account", () => {
    const eng = buildRiparto(createMinimalInput());
    expect(
      eng.columns.map((c) => {
        return c.legacyAccountId;
      }),
    ).toEqual(["A"]);
    expect(must(eng.columns[0], "the first column").displayTableId).toBe("T");
  });

  it("subtree throws for an account the input does not have", () => {
    const engine = buildRiparto(createMinimalInput());

    expect(() => {
      return engine.subtree("nope");
    }).toThrow("missing: the account nope");
  });

  it("splits the estimate per unit by coefficient", () => {
    const eng = buildRiparto(createMinimalInput());
    expect(eng.perUnitAmount("A", "estimate", "u1")).toBe(60000);
    expect(eng.perUnitAmount("A", "estimate", "u2")).toBe(40000);
  });

  it("routes a unit's amount to its single owner resident", () => {
    const eng = buildRiparto(createMinimalInput());
    const r = eng.perResidentAmount("A", "estimate", "u1");
    expect(r.get("r1")).toBe(60000);
    expect(
      [...r.values()].reduce((s, c) => {
        return s + c;
      }, 0),
    ).toBe(60000);
  });

  it("applies an owner/tenant role split (priority 1 = owner 70%, priority 3 = tenant 30%)", () => {
    const withRoles: RipartoInput = {
      ...createMinimalInput(),
      links: [
        { accountId: "A", linkId: "L1", tableId: "T", pct: 100, type: null },
      ],
      roles: [
        { linkId: "L1", priorityId: "1", percentage: 70 },
        { linkId: "L1", priorityId: "3", percentage: 30 },
      ],
      residents: [
        {
          unitId: "u1",
          residentId: "owner1",
          priorityId: "1",
          percentage: 100,
        },
        {
          unitId: "u1",
          residentId: "tenant1",
          priorityId: "3",
          percentage: 100,
        },
        { unitId: "u2", residentId: "r2", priorityId: "1", percentage: 100 },
      ],
    };
    const eng = buildRiparto(withRoles);
    const r = eng.perResidentAmount("A", "estimate", "u1"); // u1 share = 60000
    expect(r.get("owner1")).toBe(42000); // 70%
    expect(r.get("tenant1")).toBe(18000); // 30% (residual to last role)
    expect(
      [...r.values()].reduce((s, c) => {
        return s + c;
      }, 0),
    ).toBe(60000);
  });

  it("conserves money: Σ per-unit equals the rolled-up subtree estimate", () => {
    const eng = buildRiparto(createMinimalInput());
    const total = eng.unitLegacyIds.reduce((s, u) => {
      return s + eng.perUnitAmount("A", "estimate", u);
    }, 0);
    expect(total).toBe(eng.subtree("A").estimateCents);
  });

  describe("splitting among several residents of one priority", () => {
    it("splits by resident percentage when it divides exactly", () => {
      // u1 share = 100000 * 60/100 = 60000 cents.
      // Owners 75% and 25% (total 100): o1 = 60000*75/100 = 45000, o2 = 15000.
      const eng = buildRiparto({
        ...createMinimalInput(),
        residents: [owner("o1", 75), owner("o2", 25)],
      });
      const r = eng.perResidentAmount("A", "estimate", "u1");
      expect(r.get("o1")).toBe(45000);
      expect(r.get("o2")).toBe(15000);
      expect(sum(r)).toBe(60000);
    });

    it("gives the last resident the residual when percentages do not divide", () => {
      // u1 alone holds the table: share = 100 cents. Owners 1%, 1%, 1% (total 3):
      // o1 = round(100*1/3) = 33, o2 = 33, o3 = 100 - 66 = 34 (not round = 33).
      const eng = buildRiparto({
        ...createMinimalInput(),
        estimateCentsByAccount: { A: 100 },
        tableItems: [{ tableId: "T", unitId: "u1", coefficient: 100 }],
        residents: [owner("o1", 1), owner("o2", 1), owner("o3", 1)],
      });
      const r = eng.perResidentAmount("A", "estimate", "u1");
      expect(r.get("o1")).toBe(33);
      expect(r.get("o2")).toBe(33);
      expect(r.get("o3")).toBe(34);
      expect(sum(r)).toBe(100);
    });

    it("splits equally, the last resident taking the residual, when no percentage is set", () => {
      // Share = 100 cents over three owners at 0%: o1 = round(100/3) = 33,
      // o2 = 33, o3 = 100 - 66 = 34.
      const eng = buildRiparto({
        ...createMinimalInput(),
        estimateCentsByAccount: { A: 100 },
        tableItems: [{ tableId: "T", unitId: "u1", coefficient: 100 }],
        residents: [owner("o1", 0), owner("o2", 0), owner("o3", 0)],
      });
      const r = eng.perResidentAmount("A", "estimate", "u1");
      expect(r.get("o1")).toBe(33);
      expect(r.get("o2")).toBe(33);
      expect(r.get("o3")).toBe(34);
      expect(sum(r)).toBe(100);
    });

    it("gives the whole share to the owners when no resident has the role's priority", () => {
      // Role priority 3 takes 100%, but u1 has only owners: owners get 60000,
      // split 50/50 by percentage = 30000 and 30000.
      const eng = buildRiparto({
        ...createMinimalInput(),
        roles: [{ linkId: "L1", priorityId: "3", percentage: 100 }],
        residents: [owner("o1", 50), owner("o2", 50)],
      });
      const r = eng.perResidentAmount("A", "estimate", "u1");
      expect(r.get("o1")).toBe(30000);
      expect(r.get("o2")).toBe(30000);
      expect(sum(r)).toBe(60000);
    });

    it("skips a role whose share is zero", () => {
      // Roles: owner 100%, tenant 0% -> owner 60000, the tenant's residual is
      // 60000 - 60000 = 0 and nobody is credited for it.
      const eng = buildRiparto({
        ...createMinimalInput(),
        roles: [
          { linkId: "L1", priorityId: "1", percentage: 100 },
          { linkId: "L1", priorityId: "3", percentage: 0 },
        ],
        residents: [
          owner("o1", 100),
          { unitId: "u1", residentId: "t1", priorityId: "3", percentage: 100 },
        ],
      });
      const r = eng.perResidentAmount("A", "estimate", "u1");
      expect(r.get("o1")).toBe(60000);
      expect(r.has("t1")).toBe(false);
      expect(sum(r)).toBe(60000);
    });

    it("credits nobody when the unit has no residents", () => {
      const eng = buildRiparto({ ...createMinimalInput(), residents: [] });
      expect(eng.perResidentAmount("A", "estimate", "u1").size).toBe(0);
    });
  });

  describe("links, modes and subtrees", () => {
    it("uses the estimate link for estimates and the currentBalance link for actuals", () => {
      // Estimate 100000 at 100% and actual 50000 on the currentBalance link at
      // 50%, table T (60/40). estimate: u1 = 60000, u2 = 40000.
      // actual: u1 = 50000 * 0.5 * 0.6 = 15000, u2 = 50000 * 0.5 * 0.4 = 10000
      // (the estimate link would give 30000 / 20000).
      const eng = buildRiparto({
        ...createMinimalInput(),
        actualCentsByAccount: { A: 50000 },
        links: [
          {
            accountId: "A",
            linkId: "L1",
            tableId: "T",
            pct: 100,
            type: "estimate",
          },
          {
            accountId: "A",
            linkId: "L2",
            tableId: "T",
            pct: 50,
            type: "currentBalance",
          },
        ],
      });
      expect(eng.perUnitAmount("A", "estimate", "u1")).toBe(60000);
      expect(eng.perUnitAmount("A", "estimate", "u2")).toBe(40000);
      expect(eng.perUnitAmount("A", "current", "u1")).toBe(15000);
      expect(eng.perUnitAmount("A", "current", "u2")).toBe(10000);
    });

    it("charges nothing in a mode the account has no link for", () => {
      const eng = buildRiparto({
        ...createMinimalInput(),
        links: [
          {
            accountId: "A",
            linkId: "L1",
            tableId: "T",
            pct: 100,
            type: "currentBalance",
          },
        ],
      });
      expect(eng.perUnitAmount("A", "estimate", "u1")).toBe(0);
      expect(eng.columns).toHaveLength(1);
    });

    it("charges nothing through a table with no coefficients, or for an unknown account", () => {
      const eng = buildRiparto({
        ...createMinimalInput(),
        links: [
          {
            accountId: "A",
            linkId: "L1",
            tableId: "EMPTY",
            pct: 100,
            type: null,
          },
        ],
      });
      expect(eng.perUnitAmount("A", "estimate", "u1")).toBe(0);
      expect(eng.perUnitAmount("ZZ", "estimate", "u1")).toBe(0);
      expect(eng.perResidentAmount("ZZ", "estimate", "u1").size).toBe(0);
    });

    it("rolls a subtree up but leaves a linked descendant to its own column", () => {
      // P 100000 + child C 50000 = 150000; the linked grandchild G (20000) is
      // excluded from P and stands alone.
      const eng = buildRiparto({
        ...createMinimalInput(),
        accounts: [
          { id: "P", name: "Padre", order: 2, parentId: null },
          { id: "C", name: "Figlio", order: 3, parentId: "P" },
          { id: "G", name: "Nipote", order: 1, parentId: "C" },
        ],
        links: [
          { accountId: "P", linkId: "LP", tableId: "T", pct: 100, type: null },
          { accountId: "G", linkId: "LG", tableId: "T", pct: 100, type: null },
        ],
        estimateCentsByAccount: { P: 100000, C: 50000, G: 20000 },
        actualCentsByAccount: {},
      });
      expect(eng.subtree("P").estimateCents).toBe(150000);
      expect(eng.subtree("G").estimateCents).toBe(20000);
      expect(
        eng.columns.map((c) => {
          return c.legacyAccountId;
        }),
      ).toEqual(["G", "P"]); // ordered by account.order
    });
  });
});

// One expense account A (linked to table T at 100%), two units u1/u2 with coeffs 60/40,
// estimate 1000.00 € = 100000 cents. No role rows → goes to owners.
function createMinimalInput(): RipartoInput {
  return {
    accounts: [{ id: "A", name: "Spese", order: 1, parentId: null }],
    links: [
      { accountId: "A", linkId: "L1", tableId: "T", pct: 100, type: null },
    ],
    estimateCentsByAccount: { A: 100000 },
    actualCentsByAccount: { A: 0 },
    tableItems: [
      { tableId: "T", unitId: "u1", coefficient: 60 },
      { tableId: "T", unitId: "u2", coefficient: 40 },
    ],
    roles: [],
    residents: [
      { unitId: "u1", residentId: "r1", priorityId: "1", percentage: 100 },
      { unitId: "u2", residentId: "r2", priorityId: "1", percentage: 100 },
    ],
    unitLegacyIds: ["u1", "u2"],
  };
}

function sum(m: Map<string, number>): number {
  return [...m.values()].reduce((s, c) => {
    return s + c;
  }, 0);
}

function owner(
  id: string,
  percentage: number,
): RipartoInput["residents"][number] {
  return { unitId: "u1", residentId: id, priorityId: "1", percentage };
}
