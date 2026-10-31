import { describe, expect, it } from "vitest";

import { type Cents, cents } from "#/entities/cents.ts";
import { must } from "#/support/must.ts";
import { createSeedUnitsBooks } from "#/testing/createSeedUnitsBooks.ts";
import { buildAccountTree, findNode } from "#/useCases/accountTree.ts";

import { type UnitsList, type UnitsRow, unitsListOf } from "./unitsList.ts";

// Every row of the legacy Units list (elenco-unita.pdf), as the design's
// survey has them: Prev. bal. | Budget | Actual | Total due | Paid.
describe("the Units grid of Pozzetto 2013 (p36)", () => {
  it.each(POZZETTO_ROWS)("%s", (row, expected) => {
    expect(moneyOf(rowNamed("p36", row))).toEqual(expected);
  });

  it("closes on the rounding row: Budget −0.52, Actual and Total due −0.32", () => {
    expect(roundingOf("p36")).toMatchObject({
      previousBalance: null,
      budget: -52,
      actual: -32,
      due: -32,
      paid: null,
      overdue: null,
      adjustment: -32,
    });
  });

  it("has 11,765.90 overdue and an Adjustment of −4,955.16 (28,636.72 − 33,591.88 issued)", () => {
    expect(listOf("p36").root).toMatchObject({
      overdue: 1176590,
      adjustment: -495516,
    });
  });
});

describe("the Units grid of Saturno 2011 (p1)", () => {
  it.each(SATURNO_ROWS)("%s", (row, expected) => {
    expect(moneyOf(rowNamed("p1", row))).toEqual(expected);
  });

  it("closes on the rounding row: 0.01 of Budget, Actual and Total due", () => {
    expect(roundingOf("p1")).toMatchObject({
      previousBalance: null,
      budget: 1,
      actual: 1,
      due: 1,
      paid: null,
      overdue: null,
      adjustment: 1,
    });
  });

  it("has 4,408.95 overdue and an Adjustment of −4,944.81 (2,744.11 − 7,688.92 issued)", () => {
    expect(listOf("p1").root).toMatchObject({
      overdue: 440895,
      adjustment: -494481,
    });
  });

  it("shows A3 with 725.00 overdue on its installments while the actual costs left it in credit", () => {
    const a3 = rowNamed("p1", "A3");

    expect(a3.overdue).toBe(72500);
    expect(a3.due - must(a3.paid, "A3's paid")).toBeLessThan(0);
  });
});

describe("the books identity", () => {
  it.each([
    ["p36", 681074],
    ["p1", -53586],
  ])(
    "%s: the root's Total due − Paid is what the owners and roundings accounts hold, %i",
    (periodId, balance) => {
      const { root } = listOf(periodId);

      expect(root.due - must(root.paid, "the root's paid")).toBe(balance);
      expect(ledgerBalanceOf(periodId)).toBe(balance);
    },
  );
});

type Money = [number | null, number, number, number, number | null];

const POZZETTO_ROWS: [string, Money][] = [
  ["root", [-625099, 3800000, 3488771, 2863672, 2182598]],
  ["A01", [-86065, 168731, 156217, 70152, 28669]],
  ["A02", [-43739, 214824, 198344, 154605, 102342]],
  ["A03", [352842, 242806, 231642, 584484, 517947]],
  ["A04", [269711, 94527, 88488, 358199, 333989]],
  ["A05", [25484, 271977, 249833, 275317, 188669]],
  ["A06", [-183567, 275060, 252699, 69132, 0]],
  ["A07", [-304241, 131924, 121148, -183093, 0]],
  ["A08", [-48571, 164231, 148377, 99806, 63103]],
  ["A09", [-71060, 184958, 167426, 96366, 51846]],
  ["A10", [-129616, 160196, 144925, 15309, 0]],
  ["A11", [-13294, 188101, 168717, 155423, 114614]],
  ["A12", [-179882, 216588, 194899, 15017, 0]],
  ["A13", [-51414, 161014, 144361, 92947, 45194]],
  ["A14", [-93802, 356174, 323305, 229503, 148397]],
  ["A15", [-113949, 195891, 172999, 59050, 19255]],
  ["A16", [-110587, 216109, 194176, 83589, 19080]],
  ["A17", [151778, 304386, 292847, 444625, 358761]],
  ["A18", [4873, 252555, 238400, 243273, 190732]],
  ["A18 PR", [4873, 28325, 31141, 36014, 24134]],
  ["A18 CO", [0, 224230, 207259, 207259, 166598]],
];

const SATURNO_ROWS: [string, Money][] = [
  ["root", [28892, 740000, 245519, 274411, 327997]],
  ["group A", [8942, 704210, 230558, 239500, 312623]],
  ["A1", [3000, 85641, 24552, 27552, 31642]],
  ["A2", [562, 122873, 40568, 41130, 41435]],
  ["A2 PR", [1322, 47600, 23433, 24755, 17122]],
  ["A2 CO", [-760, 75273, 17135, 16375, 24313]],
  ["A3", [1930, 217432, 73656, 75586, 146862]],
  ["A4", [3450, 278264, 91782, 95232, 92684]],
  ["group B", [19950, 35789, 14960, 34910, 15374]],
  ["B1", [-145, 8779, 3740, 3595, 2922]],
  ["B1 PR", [1122, 5600, 2757, 3879, 2922]],
  ["B1 CO", [-1267, 3179, 983, -284, 0]],
  ["B2", [2140, 8996, 3740, 5880, 5136]],
  ["B3", [13455, 9112, 3740, 17195, 0]],
  ["B4", [4500, 8902, 3740, 8240, 7316]],
];

function listOf(periodId: string): UnitsList {
  return unitsListOf(createSeedUnitsBooks(periodId), "2026-10-30");
}

function moneyOf(row: UnitsRow): Money {
  return [row.previousBalance, row.budget, row.actual, row.due, row.paid];
}

/** "root", "group {code}", "{unit code}", or "{unit code} {role}" for one of a unit's residents. */
function rowNamed(periodId: string, name: string): UnitsRow {
  const books = createSeedUnitsBooks(periodId);
  const { root } = unitsListOf(books, "2026-10-30");

  if (name === "root") {
    return root;
  }

  const [first = "", second] = name.split(" ");

  if (first === "group") {
    const group = must(
      books.groups.find((candidate) => {
        return candidate.code === second;
      }),
      `the group ${name}`,
    );

    return rowWithKey(root, `group:${group.id}`);
  }

  const unit = must(
    books.units.find((candidate) => {
      return candidate.code === first;
    }),
    `the unit ${first}`,
  );
  const unitRow = rowWithKey(root, `unit:${unit.id}`);

  if (second === undefined) {
    return unitRow;
  }

  return must(
    unitRow.children.find((child) => {
      return child.label.endsWith(`(${second})`);
    }),
    `the ${second} of ${first}`,
  );
}

function roundingOf(periodId: string): UnitsRow {
  return rowWithKey(listOf(periodId).root, "rounding");
}

function rowWithKey(root: UnitsRow, key: string): UnitsRow {
  return must(
    flatten(root).find((row) => {
      return row.key === key;
    }),
    `the row ${key}`,
  );
}

function flatten(row: UnitsRow): UnitsRow[] {
  return [row, ...row.children.flatMap(flatten)];
}

/**
 * The owners and roundings accounts' balance in the Accounts tree, over both
 * sides: the balance sheet's owner lines (Pozzetto 8,761.30 − 1,950.22, and
 * the roundings' −0.34; Saturno 259.11 − 794.98, and 0.01).
 */
function ledgerBalanceOf(periodId: string): Cents {
  const { accounts, entries, parties } =
    createSeedUnitsBooks(periodId).schedule;
  const tree = buildAccountTree(accounts, entries, parties);

  return cents(
    accounts
      .filter((account) => {
        return account.role === "owners" || account.role === "roundings";
      })
      .flatMap((account) => {
        return [
          account.id,
          `${account.id}@assets`,
          `${account.id}@liabilities`,
        ];
      })
      .map((key): number => {
        return findNode(tree, key)?.balance ?? 0;
      })
      .reduce((total, balance) => {
        return total + balance;
      }, 0),
  );
}
