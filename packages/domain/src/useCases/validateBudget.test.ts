import { describe, expect, it } from "vitest";

import { type Account, cents } from "../index.ts";
import { validateBudget } from "./validateBudget.ts";

describe("validateBudget", () => {
  it("accepts a non-negative budget on a regular expense account", () => {
    expect(validateBudget(createAccount({}), cents(0))).toEqual({ ok: true });
    expect(validateBudget(createAccount({}), cents(216500))).toEqual({
      ok: true,
    });
  });

  it("rejects a negative budget", () => {
    expect(validateBudget(createAccount({}), cents(-1))).toEqual({
      ok: false,
      reason: "negative",
    });
  });

  it("rejects an account that is not a cost account", () => {
    expect(
      validateBudget(createAccount({ nature: "assets" }), cents(1)),
    ).toEqual({
      ok: false,
      reason: "not-a-cost-account",
    });
  });

  it("rejects a grouping, which has no budget of its own", () => {
    expect(
      validateBudget(createAccount({ type: "grouping" }), cents(1)),
    ).toEqual({
      ok: false,
      reason: "not-a-leaf",
    });
  });

  it("names the first thing wrong: the nature, then the leaf, then the sign", () => {
    expect(
      validateBudget(
        createAccount({ nature: "income", type: "grouping" }),
        cents(-1),
      ),
    ).toEqual({ ok: false, reason: "not-a-cost-account" });
    expect(
      validateBudget(createAccount({ type: "grouping" }), cents(-1)),
    ).toEqual({ ok: false, reason: "not-a-leaf" });
  });
});

function createAccount(overrides: Partial<Account>): Account {
  return {
    id: "la1",
    periodId: "p1",
    parentId: null,
    name: "Ascensore",
    order: 1,
    nature: "expenses",
    type: "regular",
    role: null,
    budget: null,
    ...overrides,
  };
}
