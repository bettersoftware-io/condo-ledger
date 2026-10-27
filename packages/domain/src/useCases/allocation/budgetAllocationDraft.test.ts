import { describe, expect, it } from "vitest";

import type { Account, AccountRole } from "#/entities/account.ts";
import { type Cents, cents } from "#/entities/cents.ts";
import type {
  Counterpart,
  EntryDraft,
  JournalEntry,
  Posting,
} from "#/entities/journal.ts";
import type { ResultOf } from "#/entities/result.ts";
import { must } from "#/support/must.ts";
import { createSeedAllocationSource } from "#/testing/createSeedAllocationSource.ts";

import {
  type Allocation,
  type AllocationRow,
  allocationBooksOf,
  allocationOf,
} from "./allocation.ts";
import { budgetAllocationDraftOf } from "./budgetAllocationDraft.ts";

describe("budgetAllocationDraftOf", () => {
  it("charges each resident in row order, 0.00 included, then the roundings to the first, then credits the budget", () => {
    const result = budgetAllocationDraftOf(
      createAllocation({ roundings: 1 }),
      [],
      ACCOUNTS,
      "Budget allocation (no.1)",
    );

    expect(result).toEqual({
      ok: true,
      value: {
        kind: "budgetAllocation",
        description: "Budget allocation (no.1)",
        postings: [
          createPosting("la9", owner("r2"), 10000, 0),
          createPosting("la9", owner("r1"), 0, 0),
          createPosting("la9", owner("r3"), 5000, 0),
          createPosting("la10", owner("r2"), 1, 0),
          createPosting("la49", null, 0, 15001),
        ],
      },
    });
  });

  it("credits negative roundings to the first resident", () => {
    expect(
      postingsOf(
        budgetAllocationDraftOf(
          createAllocation({ roundings: -52 }),
          [],
          ACCOUNTS,
          "Riparto",
        ),
      ).slice(3),
    ).toEqual([
      createPosting("la10", owner("r2"), 0, 52),
      createPosting("la49", null, 0, 14948),
    ]);
  });

  it("leaves the roundings line out when the roundings are 0", () => {
    expect(
      postingsOf(
        budgetAllocationDraftOf(
          createAllocation({ roundings: 0 }),
          [],
          ACCOUNTS,
          "Riparto",
        ),
      ).map((posting) => {
        return posting.accountId;
      }),
    ).toEqual(["la9", "la9", "la9", "la49"]);
  });

  it("refuses a period that already has a budget allocation", () => {
    expect(
      budgetAllocationDraftOf(
        createAllocation({}),
        [createEntry("tx1", "generic"), createEntry("tx5", "budgetAllocation")],
        ACCOUNTS,
        "Riparto",
      ),
    ).toEqual({ ok: false, reason: "allocation-exists" });
  });

  it.each([
    ["owners", "la9"],
    ["roundings", "la10"],
    ["budgetAllocation", "la49"],
  ] as const)(
    "refuses a period with no %s account, naming the role",
    (role, id) => {
      expect(
        budgetAllocationDraftOf(
          createAllocation({}),
          [],
          without(id),
          "Riparto",
        ),
      ).toEqual({ ok: false, reason: "missing-account", detail: role });
    },
  );

  it("refuses a budget of 0", () => {
    expect(
      budgetAllocationDraftOf(
        createAllocation({ budgetless: true, roundings: 0 }),
        [],
        ACCOUNTS,
        "Riparto",
      ),
    ).toEqual({ ok: false, reason: "no-budget" });
  });

  it("refuses a budget an account does not allocate, naming the first such account", () => {
    expect(
      budgetAllocationDraftOf(
        createAllocation({ unallocated: ["la40", "la41"] }),
        [],
        ACCOUNTS,
        "Riparto",
      ),
    ).toEqual({ ok: false, reason: "unallocated-budget", detail: "la40" });
  });

  it("answers the first reason that applies: an allocation, an account, the budget, then what is unallocated", () => {
    const zero = createAllocation({
      budgetless: true,
      roundings: 0,
      unallocated: ["la40"],
    });

    expect(
      budgetAllocationDraftOf(
        zero,
        [createEntry("tx5", "budgetAllocation")],
        [],
        "Riparto",
      ),
    ).toEqual({ ok: false, reason: "allocation-exists" });
    expect(budgetAllocationDraftOf(zero, [], [], "Riparto")).toEqual({
      ok: false,
      reason: "missing-account",
      detail: "owners",
    });
    expect(
      budgetAllocationDraftOf(zero, [], without("la10", "la49"), "Riparto"),
    ).toEqual({ ok: false, reason: "missing-account", detail: "roundings" });
    expect(budgetAllocationDraftOf(zero, [], ACCOUNTS, "Riparto")).toEqual({
      ok: false,
      reason: "no-budget",
    });
  });
});

describe("the budget allocation of the committed seed", () => {
  it("Saturno 2011 (p1), with tx5 deleted, posts tx5 again line for line", () => {
    const { draft, posted } = redraw("p1", "tx5");

    expect(lines(draft)).toEqual(lines(posted.postings));
  });

  it("Pozzetto 2013 (p36), with tx291 deleted, posts tx291's owner lines but A04's two, and one roundings line of −0.52 where tx291 has 27 of −0.02", () => {
    const { draft, posted } = redraw("p36", "tx291");

    expect(ownerLines(draft, false)).toEqual(
      ownerLines(posted.postings, false),
    );
    expect(ownerLines(draft, false)).toHaveLength(25);

    // The first difference: tx291 was typed by hand with 898.80 and 46.49
    // for A04's two residents; the legacy algorithm and its report give
    // 898.64 and 46.63. The draft writes them in row order, the earlier
    // resident (r167, until 18 January) first; tx291 in id order.
    expect(ownerLines(posted.postings, true)).toEqual([
      createPosting("la158", owner("r166"), 89880, 0),
      createPosting("la158", owner("r167"), 4649, 0),
    ]);
    expect(ownerLines(draft, true)).toEqual([
      createPosting("la158", owner("r167"), 4663, 0),
      createPosting("la158", owner("r166"), 89864, 0),
    ]);

    // The second: tx291 balances its own Σ with 27 lines of −0.02 on the
    // roundings account; the draft has one, the allocation's −0.52, on A01.
    const roundings = lines(posted.postings).filter((line) => {
      return line.accountId === "la159";
    });

    expect(roundings).toHaveLength(27);
    expect(
      roundings.every((line) => {
        return line.debit === 0 && line.credit === 2;
      }),
    ).toBe(true);
    expect(
      lines(draft).filter((line) => {
        return line.accountId === "la159";
      }),
    ).toEqual([createPosting("la159", owner("r162"), 0, 52)]);

    expect(lines(draft).at(-1)).toEqual(lines(posted.postings).at(-1));
    expect(lines(draft).at(-1)).toEqual(
      createPosting("la230", null, 0, 3800000),
    );
  });
});

/** Posting's four fields, as the brief compares them. */
interface Line {
  accountId: string;
  counterpart: Counterpart | null;
  debit: Cents;
  credit: Cents;
}

interface Redrawn {
  draft: Posting[];
  posted: JournalEntry;
}

interface AllocationShape {
  roundings?: number;
  budgetless?: boolean;
  unallocated?: string[];
}

/** The period's budget allocation drawn again over the seed with its posted entry deleted. */
function redraw(periodId: string, entryId: string): Redrawn {
  const source = createSeedAllocationSource(periodId);
  const posted = must(
    source.entries.find((entry) => {
      return entry.id === entryId;
    }),
    entryId,
  );

  const entries = source.entries.filter((entry) => {
    return entry.id !== entryId;
  });

  const allocation = allocationOf(
    allocationBooksOf({ ...source, entries }),
    "budget",
  );

  return {
    draft: postingsOf(
      budgetAllocationDraftOf(
        allocation,
        entries,
        source.accounts,
        posted.description,
      ),
    ),
    posted,
  };
}

function lines(postings: Posting[]): Line[] {
  return postings.map((posting) => {
    return createPosting(
      posting.accountId,
      posting.counterpart,
      posting.debit,
      posting.credit,
    );
  });
}

/** Pozzetto's owner lines, on la158: A04's two (r166, r167), or all the others. */
function ownerLines(postings: Posting[], a04: boolean): Line[] {
  return lines(postings).filter((line) => {
    const ofA04 = ["r166", "r167"].includes(line.counterpart?.id ?? "");

    return line.accountId === "la158" && ofA04 === a04;
  });
}

function postingsOf(result: ResultOf<EntryDraft>): Posting[] {
  if (!result.ok) {
    throw new Error(`refused: ${result.reason} ${result.detail ?? ""}`);
  }

  return result.value.postings;
}

/**
 * Group A holds r2 (100.00) and a unit of r1 (0.00) and r3 (50.00); Roundings
 * as asked. The root's total is the budget: the residents' sum and Roundings.
 */
function createAllocation(shape: AllocationShape): Allocation {
  const roundings = shape.roundings ?? 0;
  const [r2, r1, r3] = shape.budgetless === true ? [0, 0, 0] : [10000, 0, 5000];
  const residents = [
    createRow("resident:r2", "resident", r2, []),
    createRow("unit:u2", "unit", r1 + r3, [
      createRow("resident:r1", "resident", r1, []),
      createRow("resident:r3", "resident", r3, []),
    ]),
  ];

  return {
    columns: [{ accountId: "la28", label: "Proprietà" }],
    root: createRow("root", "root", r2 + r1 + r3 + roundings, [
      createRow("group:ug1", "group", r2 + r1 + r3, residents),
      createRow("roundings", "roundings", roundings, []),
    ]),
    unallocated: shape.unallocated ?? [],
  };
}

function createRow(
  key: string,
  kind: AllocationRow["kind"],
  total: number,
  children: AllocationRow[],
): AllocationRow {
  return {
    key,
    kind,
    label: key,
    role: "",
    restriction: "",
    days: "",
    amounts: [cents(total)],
    total: cents(total),
    previousBalance: null,
    due: null,
    paid: null,
    children,
  };
}

function createPosting(
  accountId: string,
  counterpart: Counterpart | null,
  debit: number,
  credit: number,
): Line {
  return { accountId, counterpart, debit: cents(debit), credit: cents(credit) };
}

function createEntry(id: string, kind: JournalEntry["kind"]): JournalEntry {
  return {
    id,
    periodId: "p1",
    number: 1,
    at: "2011-03-15T14:12:00",
    kind,
    description: id,
    postings: [],
    invoiceId: null,
  };
}

function createAccount(
  id: string,
  type: Account["type"],
  role: AccountRole | null,
): Account {
  return {
    id,
    periodId: "p1",
    parentId: null,
    name: id,
    order: 1,
    nature: role === "budgetAllocation" ? "income" : "assetsOrLiabilities",
    type,
    role,
    budget: null,
    abbreviation: null,
    links: [],
  };
}

function owner(id: string): Counterpart {
  return { kind: "owner", id };
}

function without(...ids: string[]): Account[] {
  return ACCOUNTS.filter((account) => {
    return !ids.includes(account.id);
  });
}

const ACCOUNTS: Account[] = [
  createAccount("la2", "regular", "cash"),
  createAccount("la9", "controlUnitResident", "owners"),
  createAccount("la10", "controlUnitResident", "roundings"),
  createAccount("la49", "regular", "budgetAllocation"),
];
