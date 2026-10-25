import { describe, expect, it } from "vitest";

import { type Cents, cents } from "../entities/cents.ts";
import type { InstallmentItem } from "../entities/installment.ts";
import { legacySeedData } from "../simulators/seed/legacySeed.generated.ts";
import { loadLegacySeed } from "../simulators/seed/legacySeed.ts";
import { budgetSharesOf, previousBalancesOf } from "./budgetShares.ts";
import {
  defaultPercentages,
  dueDates,
  type PlanInput,
  type PlannedInstallment,
  type PlannedItem,
  planBudgetInstallments,
} from "./planInstallments.ts";

describe("planBudgetInstallments", () => {
  it("splits the budget share by percentage, each item rounded half-up to the cent, with no remainder correction", () => {
    const plan = planBudgetInstallments(
      createInput({
        percentages: [2500, 2500, 5000],
        shares: [
          ["rA", 1050],
          ["rB", 1001],
        ],
      }),
    );

    expect(amountsOf(plan, "rA")).toEqual([263, 263, 525]);
    expect(amountsOf(plan, "rB")).toEqual([250, 250, 501]);
  });

  it("rounds a negative half away from zero, as a positive one", () => {
    const plan = planBudgetInstallments(
      createInput({
        percentages: [2500, 2500, 5000],
        shares: [["rA", -1050]],
        previousBalances: [["rA", 10000]],
      }),
    );

    expect(amountsOf(plan, "rA")).toEqual([8949, 0, 0]);
  });

  it("with whole euros, rounds items 2…n half-up to euros and gives item 1 the rest", () => {
    const plan = planBudgetInstallments(
      createInput({
        percentages: [3334, 3333, 3333],
        wholeEuros: true,
        shares: [
          ["rA", 100001],
          ["rB", 750],
        ],
      }),
    );

    expect(amountsOf(plan, "rA")).toEqual([33401, 33300, 33300]);
    expect(amountsOf(plan, "rB")).toEqual([350, 200, 200]);
  });

  it("with whole euros, rounds a half euro up", () => {
    const plan = planBudgetInstallments(
      createInput({
        percentages: [5000, 5000],
        wholeEuros: true,
        shares: [["rA", 500]],
      }),
    );

    expect(amountsOf(plan, "rA")).toEqual([200, 300]);
  });

  it("adds the previous balance to item 1 of a first batch", () => {
    const plan = planBudgetInstallments(
      createInput({
        percentages: [5000, 5000],
        shares: [["rA", 1000]],
        previousBalances: [["rA", 500]],
      }),
    );

    expect(amountsOf(plan, "rA")).toEqual([1000, 500]);
  });

  it("carries a negative item forward into the next ones", () => {
    const plan = planBudgetInstallments(
      createInput({
        percentages: [3334, 3333, 3333],
        shares: [
          ["rA", 3000],
          ["rB", 3000],
        ],
        previousBalances: [
          ["rA", -1500],
          ["rB", -2500],
        ],
      }),
    );

    expect(amountsOf(plan, "rA")).toEqual([0, 500, 1000]);
    expect(amountsOf(plan, "rB")).toEqual([0, 0, 500]);
  });

  it("carries a negative left after the last item backwards", () => {
    const plan = planBudgetInstallments(
      createInput({
        percentages: [5000, 5000],
        shares: [["rA", -300]],
        previousBalances: [["rA", 1000]],
      }),
    );

    expect(amountsOf(plan, "rA")).toEqual([700, 0]);
  });

  it("drops a credit larger than every item: all are 0", () => {
    const plan = planBudgetInstallments(
      createInput({
        percentages: [5000, 5000],
        shares: [["rA", 1000]],
        previousBalances: [["rA", -5000]],
      }),
    );

    expect(amountsOf(plan, "rA")).toEqual([0, 0]);
  });

  it("over existing items, schedules what they left out and adds no previous balance", () => {
    const plan = planBudgetInstallments(
      createInput({
        percentages: [5000, 5000],
        shares: [
          ["rA", 1000],
          ["rB", 2000],
        ],
        previousBalances: [
          ["rA", 200],
          ["rB", 0],
        ],
        existingItems: [
          createItem("rA", 400),
          createItem("rA", 300),
          createItem("rB", 1000),
        ],
      }),
    );

    expect(amountsOf(plan, "rA")).toEqual([250, 250]);
    expect(amountsOf(plan, "rB")).toEqual([500, 500]);
  });

  it("gives every resident an item on every installment, zero for one with no share, in resident then installment order", () => {
    const plan = planBudgetInstallments(
      createInput({
        percentages: [5000, 5000],
        residents: ["rA", "rZ"],
        shares: [["rA", 1000]],
      }),
    );

    expect(plan).toEqual([
      { installmentIndex: 0, residentId: "rA", amount: 500 },
      { installmentIndex: 1, residentId: "rA", amount: 500 },
      { installmentIndex: 0, residentId: "rZ", amount: 0 },
      { installmentIndex: 1, residentId: "rZ", amount: 0 },
    ]);
  });

  it("plans nothing without installments", () => {
    const plan = planBudgetInstallments(
      createInput({
        percentages: [],
        wholeEuros: true,
        shares: [["rA", 1000]],
      }),
    );

    expect(plan).toEqual([]);
  });

  it("reproduces Pozzetto 2013's 12 installments for 25 of 27 residents: r166 and r167 differ, their allocation having changed since", () => {
    const { matching, differing } = reproduce(
      "p36",
      defaultPercentages(12),
      false,
    );

    expect(matching).toHaveLength(25);
    expect(differing).toEqual(["r166", "r167"]);
  });

  // The spec expects 9 of 10. r5 also differs: its stored items 2 and 3 are a
  // third of its share in whole euros (2,782.64 / 3 = 927.55 → 928), and
  // 33.33% of it is 927.45 → 927. No two-decimal percentage is a third.
  it("reproduces Saturno 2011's 3 whole-euro installments for 8 of 10 residents: r1 is off by its rounding line, r5 by a third against 33.33%", () => {
    const { matching, differing, planned, stored } = reproduce(
      "p1",
      [3334, 3333, 3333],
      true,
    );

    expect(matching).toHaveLength(8);
    expect(differing).toEqual(["r1", "r5"]);
    expect(amountsOf(planned, "r1")).toEqual([31641, 28500, 28500]);
    expect(stored.get("r1")).toEqual([31642, 28500, 28500]);
    expect(amountsOf(planned, "r5")).toEqual([96314, 92700, 92700]);
    expect(stored.get("r5")).toEqual([96114, 92800, 92800]);
  });

  it("over Pozzetto 2013's schedule, a second batch of 2 gives each resident max(0, Prev. bal. + Total budget − its items), r170 and r176 0", () => {
    const period = periodOf("p36");
    const input: PlanInput = {
      installments: createInstallments([5000, 5000]),
      wholeEuros: true,
      residents: period.residents,
      shares: period.shares,
      previousBalances: period.previousBalances,
      existingItems: period.items,
    };

    const plan = planBudgetInstallments(input);

    expect(period.residents).toHaveLength(27);

    for (const residentId of period.residents) {
      const owed =
        (period.shares.get(residentId) ?? 0) +
        (period.previousBalances.get(residentId) ?? 0) -
        sum(amountsOf(period.items, residentId));

      expect(
        { residentId, total: sum(amountsOf(plan, residentId)) },
        residentId,
      ).toEqual({ residentId, total: Math.max(0, owed) });
    }

    expect(sum(amountsOf(plan, "r170"))).toBe(0);
    expect(sum(amountsOf(plan, "r176"))).toBe(0);
  });
});

describe("defaultPercentages", () => {
  it("gives each floor(100 / n) percent and the first the rest, in hundredths of a percent", () => {
    expect(defaultPercentages(3)).toEqual([3400, 3300, 3300]);
    expect(defaultPercentages(12)).toEqual([1200, ...Array(11).fill(800)]);
    expect(defaultPercentages(1)).toEqual([10000]);
  });
});

describe("dueDates", () => {
  it("steps by whole months from the first, the day clamped to the month's last", () => {
    expect(dueDates("2013-01-31", 3, 1)).toEqual([
      "2013-01-31",
      "2013-02-28",
      "2013-03-31",
    ]);
    expect(dueDates("2012-01-31", 2, 1)).toEqual(["2012-01-31", "2012-02-29"]);
    expect(dueDates("2011-03-15", 3, 4)).toEqual([
      "2011-03-15",
      "2011-07-15",
      "2011-11-15",
    ]);
  });

  it("rolls over into the next years", () => {
    expect(dueDates("2013-10-31", 3, 5)).toEqual([
      "2013-10-31",
      "2014-03-31",
      "2014-08-31",
    ]);
  });
});

const seed = loadLegacySeed(legacySeedData);

interface SeedPeriod {
  residents: string[];
  shares: Map<string, Cents>;
  previousBalances: Map<string, Cents>;
  /** The period's stored items, in installment number order. */
  items: InstallmentItem[];
}

interface Reproduction {
  matching: string[];
  differing: string[];
  planned: PlannedItem[];
  stored: Map<string, number[]>;
}

/** Plans the period's schedule afresh, its installments set aside, and compares each resident's items with the stored ones. */
function reproduce(
  periodId: string,
  percentages: number[],
  wholeEuros: boolean,
): Reproduction {
  const period = periodOf(periodId);
  const planned = planBudgetInstallments({
    installments: createInstallments(percentages),
    wholeEuros,
    residents: period.residents,
    shares: period.shares,
    previousBalances: period.previousBalances,
    existingItems: [],
  });

  const stored = new Map(
    period.residents.map((residentId) => {
      return [residentId, amountsOf(period.items, residentId)];
    }),
  );

  const matching = period.residents.filter((residentId) => {
    return (
      JSON.stringify(amountsOf(planned, residentId)) ===
      JSON.stringify(stored.get(residentId))
    );
  });

  const differing = period.residents.filter((residentId) => {
    return !matching.includes(residentId);
  });

  return { matching, differing, planned, stored };
}

function periodOf(periodId: string): SeedPeriod {
  const entries = seed.entries.filter((entry) => {
    return entry.periodId === periodId;
  });

  const accounts = seed.accounts.filter((account) => {
    return account.periodId === periodId;
  });

  const parties =
    seed.parties.find((list) => {
      return list.periodId === periodId;
    })?.parties ?? [];

  const installments = seed.installments
    .filter((installment) => {
      return installment.periodId === periodId;
    })
    .sort((a, b) => {
      return a.number - b.number;
    });

  const items = installments.flatMap((installment) => {
    return seed.installmentItems.filter((item) => {
      return item.installmentId === installment.id;
    });
  });

  return {
    residents: parties
      .filter((party) => {
        return party.kind === "owner";
      })
      .map((party) => {
        return party.id;
      }),
    shares: budgetSharesOf(entries, accounts).shares,
    previousBalances: previousBalancesOf(entries, accounts, parties),
    items,
  };
}

interface InputOptions {
  percentages: number[];
  wholeEuros?: boolean;
  residents?: string[];
  shares: [string, number][];
  previousBalances?: [string, number][];
  existingItems?: InstallmentItem[];
}

function createInput(options: InputOptions): PlanInput {
  return {
    installments: createInstallments(options.percentages),
    wholeEuros: options.wholeEuros ?? false,
    residents:
      options.residents ??
      options.shares.map(([residentId]) => {
        return residentId;
      }),
    shares: toCentsMap(options.shares),
    previousBalances: toCentsMap(options.previousBalances ?? []),
    existingItems: options.existingItems ?? [],
  };
}

function createInstallments(percentages: number[]): PlannedInstallment[] {
  return percentages.map((percentage, index) => {
    return {
      name: `Installment ${index + 1}`,
      dueDate: "2013-01-20",
      percentage,
    };
  });
}

function createItem(residentId: string, amount: number): InstallmentItem {
  return {
    id: `ii-${residentId}-${amount}`,
    installmentId: "in1",
    residentId,
    amount: cents(amount),
  };
}

function toCentsMap(pairs: [string, number][]): Map<string, Cents> {
  return new Map(
    pairs.map(([residentId, amount]) => {
      return [residentId, cents(amount)];
    }),
  );
}

/** The resident's amounts, in list order. */
function amountsOf(
  items: (PlannedItem | InstallmentItem)[],
  residentId: string,
): number[] {
  return items
    .filter((item) => {
      return item.residentId === residentId;
    })
    .map((item) => {
      return item.amount;
    });
}

function sum(values: number[]): number {
  return values.reduce((total, value) => {
    return total + value;
  }, 0);
}
