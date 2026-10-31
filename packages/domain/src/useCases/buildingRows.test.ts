import { describe, expect, it } from "vitest";

import type { Account } from "#/entities/account.ts";
import type { Building, Period } from "#/entities/building.ts";
import {
  addCents,
  type Cents,
  cents,
  subtractCents,
  ZERO_CENTS,
} from "#/entities/cents.ts";
import { legacySeedData } from "#/simulators/seed/legacySeed.generated.ts";
import { loadLegacySeed } from "#/simulators/seed/legacySeed.ts";
import { must } from "#/support/must.ts";
import { createSeedAllocationSource } from "#/testing/createSeedAllocationSource.ts";
import { createSeedUnitsBooks } from "#/testing/createSeedUnitsBooks.ts";

import { type AccountNode, buildAccountTree, findNode } from "./accountTree.ts";
import {
  buildingRowsOf,
  type PeriodFigures,
  periodFiguresOf,
} from "./buildingRows.ts";
import { type UnitsList, unitsListOf } from "./units/unitsList.ts";

describe("periodFiguresOf on the seed", () => {
  it.each([
    {
      periodId: "p1",
      expected: {
        liquidity: cents(295_414),
        funds: cents(175_000),
        budget: cents(740_000),
        actual: cents(245_519),
        previousBalance: cents(28_892),
        due: cents(274_411),
      },
    },
    {
      periodId: "p36",
      expected: {
        liquidity: cents(107_826),
        funds: cents(0),
        budget: cents(3_800_000),
        actual: cents(3_488_771),
        previousBalance: cents(-625_099),
        due: cents(2_863_672),
      },
    },
  ])(
    "gives $periodId the spec's Liquidity, Funds, Budget, Actual, Prev. bal. and Total due",
    ({ periodId, expected }) => {
      const { list, tree, accounts } = createSeedPeriod(periodId);

      expect(periodFiguresOf(list, tree, accounts)).toEqual(expected);
    },
  );

  // Danea's identity (bu-danea.md §4): Σ final balances = Funds + payables to
  // third parties − receivables from them − Liquidity. Every term is a named
  // node of the Accounts tree; the owners' and roundings' accounts, the rest
  // of the balance sheet, are what the Units root's due − paid already holds.
  it.each([
    {
      periodId: "p36",
      // Payables vs suppliers on the liabilities side, the tax authority and
      // the administration's advances; receivables: suppliers in debit.
      payables: ["la157@liabilities", "la161", "la169"],
      receivables: ["la157@assets"],
      owners: ["la158@assets", "la158@liabilities"],
      roundings: ["la159@assets", "la159@liabilities"],
      expected: {
        payables: cents(788_900),
        receivables: cents(0),
        finalBalances: cents(681_074),
      },
    },
    {
      periodId: "p1",
      // "Payables to third parties": the suppliers and the tax authority.
      payables: ["la15"],
      receivables: [],
      owners: ["la9@assets", "la9@liabilities"],
      roundings: ["la10@assets"],
      expected: {
        payables: cents(66_828),
        receivables: cents(0),
        finalBalances: cents(-53_586),
      },
    },
  ])(
    "ties $periodId's Funds and Liquidity to the Units root's due − paid through the third parties' accounts",
    ({ periodId, payables, receivables, owners, roundings, expected }) => {
      const { list, tree, accounts } = createSeedPeriod(periodId);
      const figures = periodFiguresOf(list, tree, accounts);
      const owed = negated(balanceOf(tree, payables));
      const owing = balanceOf(tree, receivables);
      const paid = must(list.root.paid, "the Units root's Paid");

      expect([owed, owing]).toEqual([expected.payables, expected.receivables]);
      expect(figures.funds + owed - owing - figures.liquidity).toBe(
        expected.finalBalances,
      );
      expect(figures.due - paid).toBe(expected.finalBalances);
      expect(
        patrimonialKeys(tree),
        "every line of the balance sheet is one of the named terms",
      ).toEqual(
        [
          liquidityKey(accounts),
          fundsKey(accounts),
          ...payables,
          ...receivables,
          ...owners,
          ...roundings,
        ].sort(),
      );
    },
  );
});

describe("buildingRowsOf", () => {
  it("lists the seed's buildings by name, Pozzetto then Saturno, each over its one period with its figures", () => {
    const figures = new Map<string, PeriodFigures>([
      ["p1", createFigures(1)],
      ["p36", createFigures(36)],
    ]);

    const rows = buildingRowsOf(
      loadLegacySeed(legacySeedData).buildings,
      figures,
    );

    expect(rows).toEqual([
      {
        key: "c19",
        kind: "building",
        buildingId: "c19",
        periodId: null,
        code: "",
        label: "Pozzetto (Piazza Libertà, 74, 33045 Nimis)",
        type: "building",
        closed: null,
        dates: "",
        figures: null,
        children: [
          {
            key: "p36",
            kind: "period",
            buildingId: "c19",
            periodId: "p36",
            code: "",
            label: "2013 (Ordinary)",
            type: "ordinary",
            closed: false,
            dates: "01/01/2013 - 31/12/2013",
            figures: createFigures(36),
            children: [],
          },
        ],
      },
      {
        key: "c1",
        kind: "building",
        buildingId: "c1",
        periodId: null,
        code: "SAT",
        label: "Saturno (Piazza del Duomo, 39, 33033 Codroipo)",
        type: "building",
        closed: null,
        dates: "",
        figures: null,
        children: [
          {
            key: "p1",
            kind: "period",
            buildingId: "c1",
            periodId: "p1",
            code: "",
            label: "2011 (Ordinary)",
            type: "ordinary",
            closed: false,
            dates: "01/01/2011 - 31/12/2011",
            figures: createFigures(1),
            children: [],
          },
        ],
      },
    ]);
  });

  it("orders periods by start, words their type, and leaves the figures null for a period not yet worked out", () => {
    const building = createBuilding("b1", "Aurora", [
      createPeriod("q2", "2021 lift", "extra", "2021-03-01", true),
      createPeriod("q1", "2021", "ordinary", "2021-01-01", false),
      createPeriod("q3", "2021 garden", "auxiliary", "2021-06-01", false),
    ]);

    const [row] = buildingRowsOf(
      [building],
      new Map([["q1", createFigures(7)]]),
    );

    expect(row?.label).toBe("Aurora");
    expect(
      row?.children.map((child) => {
        return [child.label, child.closed, child.figures];
      }),
    ).toEqual([
      ["2021 (Ordinary)", false, createFigures(7)],
      ["2021 lift (Extraordinary)", true, null],
      ["2021 garden (Auxiliary)", false, null],
    ]);
  });
});

interface SeedPeriod {
  list: UnitsList;
  tree: AccountNode;
  accounts: Account[];
}

function createSeedPeriod(periodId: string): SeedPeriod {
  const source = createSeedAllocationSource(periodId);

  return {
    list: unitsListOf(createSeedUnitsBooks(periodId), TODAY),
    tree: buildAccountTree(source.accounts, source.entries, source.parties),
    accounts: source.accounts,
  };
}

function createFigures(seed: number): PeriodFigures {
  return {
    liquidity: cents(seed * 100),
    funds: cents(seed * 200),
    budget: cents(seed * 300),
    actual: cents(seed * 400),
    previousBalance: cents(seed * 500),
    due: cents(seed * 900),
  };
}

function createBuilding(id: string, name: string, periods: Period[]): Building {
  return {
    id,
    name,
    code: null,
    type: "building",
    status: "active",
    address: null,
    taxCode: null,
    constructionDate: null,
    cadastralData: null,
    notes: null,
    createdOn: "2021-01-01 09:00:00",
    modifiedOn: "2021-01-01 09:00:00",
    periods,
  };
}

function createPeriod(
  id: string,
  name: string,
  type: Period["type"],
  start: string,
  closed: boolean,
): Period {
  return {
    id,
    name,
    type,
    start,
    end: "2021-12-31",
    closed,
    notes: null,
  };
}

function balanceOf(tree: AccountNode, keys: string[]): Cents {
  return keys
    .map((key) => {
      return must(findNode(tree, key), `the node ${key}`).balance;
    })
    .reduce(addCents, ZERO_CENTS);
}

function negated(amount: Cents): Cents {
  return subtractCents(ZERO_CENTS, amount);
}

function patrimonialKeys(tree: AccountNode): string[] {
  return ["assets", "liabilities"]
    .flatMap((side) => {
      return must(findNode(tree, side), `the ${side} level`).children;
    })
    .map((node) => {
      return node.key;
    })
    .sort();
}

function liquidityKey(accounts: Account[]): string {
  return must(
    accounts.find((account) => {
      return account.role === "liquidity";
    }),
    "the liquidity account",
  ).id;
}

function fundsKey(accounts: Account[]): string {
  return must(
    accounts.find((account) => {
      return account.role === "funds";
    }),
    "the funds account",
  ).id;
}

const TODAY = "2026-10-31";
