// packages/domain/src/riparto/computeRiparto.test.ts
import { describe, expect, it } from "vitest";

import { must } from "../must.ts";
import { buildRiparto } from "./computeRiparto.ts";
import type { RipartoInput } from "./types.ts";

describe("computeRiparto", () => {
  it("exposes one column for the linked account", () => {
    const eng = buildRiparto(base);
    expect(
      eng.columns.map((c) => {
        return c.legacyAccountId;
      }),
    ).toEqual(["A"]);
    expect(must(eng.columns[0]).displayTableId).toBe("T");
  });

  it("splits the estimate per unit by coefficient", () => {
    const eng = buildRiparto(base);
    expect(eng.perUnitAmount("A", "estimate", "u1")).toBe(60000);
    expect(eng.perUnitAmount("A", "estimate", "u2")).toBe(40000);
  });

  it("routes a unit's amount to its single owner resident", () => {
    const eng = buildRiparto(base);
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
      ...base,
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
    const eng = buildRiparto(base);
    const total = eng.unitLegacyIds.reduce((s, u) => {
      return s + eng.perUnitAmount("A", "estimate", u);
    }, 0);
    expect(total).toBe(eng.subtree("A").estimateCents);
  });
});

// One expense account A (linked to table T at 100%), two units u1/u2 with coeffs 60/40,
// estimate 1000.00 € = 100000 cents. No role rows → goes to owners.
const base: RipartoInput = {
  accounts: [{ id: "A", name: "Spese", order: 1, parentId: null }],
  links: [{ accountId: "A", linkId: "L1", tableId: "T", pct: 100, type: null }],
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
