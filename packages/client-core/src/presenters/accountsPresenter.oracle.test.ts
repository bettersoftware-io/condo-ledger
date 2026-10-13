import { describe, expect, it } from "vitest";

import type { AccountNode } from "@cl/domain";
import {
  type OracleNode,
  POZZETTO_2013_ORACLE,
} from "@cl/domain/testing/pozzetto2013.oracle.ts";

import { createAppHarness } from "../testing/appHarness.ts";

describe("the Accounts screen on Pozzetto 2013", () => {
  it("reconciles every node of the chart of accounts to the oracle: keys, amounts, budgets, children", () => {
    const { app } = createAppHarness();
    let tree: AccountNode | null = null;
    app.presenters.accounts.tree$.subscribe((next) => {
      tree = next;
    });

    app.presenters.buildings.selectPeriod("p36");

    const mismatches: string[] = [];
    compare(POZZETTO_2013_ORACLE, tree, mismatches);
    expect(mismatches).toEqual([]);
    expect(tree).toMatchObject({
      debit: 13788287,
      credit: 13788287,
      balance: 0,
    });
  });
});

function compare(
  expected: OracleNode,
  actual: AccountNode | null,
  mismatches: string[],
): void {
  if (actual === null) {
    mismatches.push("no tree");
    return;
  }

  if (
    expected.key !== actual.key ||
    expected.debit !== actual.debit ||
    expected.credit !== actual.credit ||
    expected.balance !== actual.balance ||
    expected.budget !== actual.budget
  ) {
    mismatches.push(
      `${expected.key} ${expected.debit}/${expected.credit}/${expected.balance}/${expected.budget} vs ${actual.key} ${actual.debit}/${actual.credit}/${actual.balance}/${actual.budget}`,
    );
  }

  if (expected.children.length !== actual.children.length) {
    mismatches.push(
      `${expected.key}: ${expected.children.length} children expected, ${actual.children.length} found`,
    );
    return;
  }

  expected.children.forEach((child, index) => {
    compare(child, actual.children[index] ?? null, mismatches);
  });
}
