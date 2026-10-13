import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  type OracleNode,
  POZZETTO_2013_ORACLE,
} from "@cl/client-core/testing/fixtures/pozzetto2013.oracle.ts";

import { DUMP_SUITE_TIMEOUT_MS } from "#/legacyDump.ts";
import {
  DEVIATIONS,
  type DesignNode,
  type Deviation,
  designOracleAvailable,
  designOraclePath,
  oracleSuiteName,
  parseDesignOracle,
} from "#/oracle/designOracle.ts";

describe.skipIf(!designOracleAvailable())(
  oracleSuiteName("the committed fixture against the design's acc.json"),
  { timeout: DUMP_SUITE_TIMEOUT_MS },
  () => {
    it("has the same amounts on every node, walked in the report's order", () => {
      const design = parseDesignOracle(
        readFileSync(designOraclePath(), "utf8"),
      );
      const mismatches: string[] = [];

      compare(design, POZZETTO_2013_ORACLE, mismatches);

      expect(mismatches).toEqual([]);
    });
  },
);

/**
 * Walks both trees together. An oracle-only node is skipped; a moved one is
 * compared at its named key; a person row the report prints as a leaf is
 * compared on its amounts only; the rows of a control account pair up in
 * amount order; the rest pair up by position.
 */
function compare(
  design: DesignNode,
  fixture: OracleNode,
  mismatches: string[],
): void {
  const amounts = [design.debit, design.credit, design.balance];
  const ours = [fixture.debit, fixture.credit, fixture.balance];
  const budgetDiffers =
    design.budget !== null &&
    design.budget !== fixture.budget &&
    !deviates(design.id, "budget");

  if (amounts.join() !== ours.join() || budgetDiffers) {
    mismatches.push(
      `${design.id} "${design.label}" ${amounts.join("/")} budget ${design.budget} vs ${fixture.key} ${ours.join("/")} budget ${fixture.budget}`,
    );
  }

  if (design.kids.length === 0 && holdsResidencyRows(fixture)) {
    return;
  }

  const kids = design.kids.filter((kid) => {
    return !deviates(kid.id, "oracle-only");
  });

  const moved = new Map(
    DEVIATIONS.filter((deviation) => {
      return deviation.kind === "moved";
    }).map((deviation) => {
      return [deviation.oracleId, deviation.fixtureKey];
    }),
  );
  const movedKeys = new Set(moved.values());
  const ownKids = kids.filter((kid) => {
    return !moved.has(kid.id);
  });

  const children = fixture.children.filter((child) => {
    return !movedKeys.has(child.key);
  });

  if (ownKids.length !== children.length) {
    mismatches.push(
      `${design.id} "${design.label}" has ${ownKids.length} children, ${fixture.key} has ${children.length}: [${children
        .map((child) => {
          return child.key;
        })
        .join(", ")}]`,
    );

    return;
  }

  const control = isControlAccount(fixture);
  const pairedKids = control ? inAmountOrder(ownKids, kidCount) : ownKids;
  const pairedChildren = control
    ? inAmountOrder(children, childCount)
    : children;

  pairedKids.forEach((kid, index) => {
    compare(kid, pairedChildren[index] as OracleNode, mismatches);
  });

  for (const kid of kids) {
    const key = moved.get(kid.id);

    if (key !== undefined) {
      const target = findKey(POZZETTO_2013_ORACLE, key);

      if (target === undefined) {
        mismatches.push(`moved ${kid.id} names an unknown fixture key ${key}`);
      } else {
        compare(kid, target, mismatches);
      }
    }
  }
}

function deviates(oracleId: string, kind: Deviation["kind"]): boolean {
  return DEVIATIONS.some((deviation) => {
    return deviation.oracleId === oracleId && deviation.kind === kind;
  });
}

/** A control account's node: its rows' keys extend its own (`la157@assets/md80`), where an account's children have their own ids. */
function isControlAccount(node: OracleNode): boolean {
  return (
    node.children.length > 0 &&
    node.children.every((child) => {
      return child.key.startsWith(`${node.key}/`);
    })
  );
}

/** A person row: every child is a residency leaf (`la158@assets/md104/r177`). */
function holdsResidencyRows(node: OracleNode): boolean {
  return (
    node.children.length > 0 &&
    node.children.every((child) => {
      return child.children.length === 0 && child.key.split("/").length === 3;
    })
  );
}

interface Amounts {
  debit: number;
  credit: number;
  balance: number;
}

function inAmountOrder<T extends Amounts>(
  nodes: T[],
  count: (node: T) => number,
): T[] {
  return nodes.slice().sort((a, b) => {
    return (
      a.debit - b.debit ||
      a.credit - b.credit ||
      a.balance - b.balance ||
      count(a) - count(b)
    );
  });
}

function kidCount(node: DesignNode): number {
  return node.kids.length;
}

function childCount(node: OracleNode): number {
  return node.children.length;
}

function findKey(node: OracleNode, key: string): OracleNode | undefined {
  if (node.key === key) {
    return node;
  }

  for (const child of node.children) {
    const found = findKey(child, key);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}
