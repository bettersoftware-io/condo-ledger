import { cents } from "#/entities/cents.ts";
import { rate } from "#/entities/invoice.ts";
import type { LegacySeed } from "#/simulators/seed/legacySeed.ts";

import { createSmallSeed } from "./createSmallBooks.ts";

/**
 * The small seed with a second period, p2, holding books of its own (a cash
 * account and a suppliers account, one entry between them naming supplier
 * md1, its one party), and p1's entries in reverse number order: what a simulator must
 * filter by period and sort. p2's books are whole, so the chart of accounts
 * can be built from them too. p1 also holds a tax leaf, Ritenute (la7), and a
 * withholding catalogue of one code, 1040 at 20% on it, and a schedule of one
 * installment, Rata 1 due 2013-03-31, with an item of 500.00 for r1 and one of
 * 400.00 for r3.
 */
export function createTwoPeriodSeed(): LegacySeed {
  const seed = createSmallSeed();
  const building = seed.buildings[0];
  const cash = seed.accounts.find((account) => {
    return account.id === "la1";
  });

  const suppliers = seed.accounts.find((account) => {
    return account.id === "la4";
  });
  const entry = seed.entries[0];
  const firstPeriod = building?.periods[0];

  if (
    building === undefined ||
    firstPeriod === undefined ||
    cash === undefined ||
    suppliers === undefined ||
    entry === undefined
  ) {
    throw new Error(
      "missing: the small seed's first building, cash and suppliers accounts, first entry",
    );
  }

  return {
    ...seed,
    buildings: [
      {
        ...building,
        periods: [
          ...building.periods,
          { ...firstPeriod, id: "p2", name: "2014" },
        ],
      },
    ],
    accounts: [
      ...seed.accounts,
      {
        ...cash,
        id: "la7",
        parentId: null,
        name: "Ritenute",
        order: 7,
        nature: "liabilities",
        role: "tax",
      },
      { ...cash, id: "x1", periodId: "p2", parentId: null },
      { ...suppliers, id: "x4", periodId: "p2" },
    ],
    entries: [
      {
        ...entry,
        id: "x-e1",
        periodId: "p2",
        number: 0,
        postings: [
          {
            accountId: "x1",
            debit: cents(36018),
            credit: cents(0),
            counterpart: null,
          },
          {
            accountId: "x4",
            debit: cents(0),
            credit: cents(36018),
            counterpart: { kind: "supplier", id: "md1" },
          },
        ],
      },
      ...[...seed.entries].reverse(),
    ],
    parties: [
      ...seed.parties,
      {
        periodId: "p2",
        parties: [{ kind: "supplier", id: "md1", name: "Alfa s.n.c." }],
      },
    ],
    withholdingTaxes: [
      {
        periodId: "p1",
        code: "1040",
        name: "Lavoratori autonomi",
        rate: rate(2000),
        accountId: "la7",
      },
    ],
    installments: [
      {
        id: "in1",
        periodId: "p1",
        number: 1,
        name: "Rata 1",
        dueDate: "2013-03-31",
      },
    ],
    installmentItems: [
      {
        id: "ii1",
        installmentId: "in1",
        residentId: "r1",
        amount: cents(50000),
      },
      {
        id: "ii2",
        installmentId: "in1",
        residentId: "r3",
        amount: cents(40000),
      },
    ],
  };
}
