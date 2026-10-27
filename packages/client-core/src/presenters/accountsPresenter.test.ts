import { BehaviorSubject, of } from "rxjs";
import { describe, expect, it } from "vitest";

import {
  type AccountNode,
  cents,
  createAccountsSimulator,
  createInstallmentsSimulator,
  createJournalSimulator,
  findNode,
  fixedClock,
  type Ledger,
  type LegacySeed,
  type TableLink,
  type ThousandthTable,
} from "@cl/domain";
import { createLink } from "@cl/domain/testing/createAllocationInput.ts";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";
import { createTablesSeed } from "@cl/domain/testing/createTablesSeed.ts";

import {
  type AccountDetails,
  type AccountsPresenter,
  createAccountsPresenter,
} from "./accountsPresenter.ts";
import { createBooksPresenter } from "./booksPresenter.ts";
import type { PeriodSelection } from "./buildingsPresenter.ts";

describe("the accounts presenter", () => {
  it("derives the tree of the selected period", () => {
    const { latest } = createPresented(createSmallSeed());

    expect(latest().tree?.children.map(keyOf)).toEqual([
      "patrimonial",
      "costs",
      "revenue",
    ]);
    expect(latest().tree?.debit).toBe(212619);
  });

  it("starts on Total and answers its ledger and details", () => {
    const { latest } = createPresented(createSmallSeed());

    expect(latest().selectedKey).toBe("total");
    expect(latest().ledger?.lines).toHaveLength(20);
    expect(latest().details).toEqual({
      path: "Total",
      typeLabel: "Non-movable / grouping",
      natureLabel: "—",
      isCost: false,
      debit: 212619,
      credit: 212619,
      balance: 0,
      budget: 150000,
      systemId: "—",
      allocationTables: { rows: [], inherited: false, separate: false },
    });
  });

  it("lists a cost account's own links with each table's name, and says when one serves a single allocation", () => {
    const { presenter, latest } = createPresented(createTablesSeed());

    presenter.select("la21");

    expect(latest().details?.allocationTables).toEqual({
      rows: [
        {
          id: "el1",
          percentage: null,
          table: "Property",
          roles: { 1: null, 2: null, 3: null, 4: null },
        },
      ],
      inherited: false,
      separate: true,
    });
  });

  it("a cost account with no links takes its nearest ancestor's, inherited; a role without a row reads blank", () => {
    const seed = createTablesSeed();
    const { presenter, latest } = createPresented({
      ...seed,
      accounts: seed.accounts.map((account) => {
        if (account.id === "la20") {
          return { ...account, links: [createSharedLink()] };
        }

        return account.id === "la21" ? { ...account, links: [] } : account;
      }),
    });

    presenter.select("la21");

    expect(latest().details?.allocationTables).toEqual({
      rows: [
        {
          id: "el2",
          percentage: 5000,
          table: "Lift",
          roles: { 1: 5000, 2: null, 3: 5000, 4: null },
        },
      ],
      inherited: true,
      separate: false,
    });
  });

  it("names a table the period's tables do not hold by nothing", () => {
    const { presenter, latest } = createPresented(
      createTablesSeed(),
      POZZETTO_2013,
      [],
    );

    presenter.select("la21");

    expect(latest().details?.allocationTables.rows[0]?.table).toBe("");
  });

  it("selects a node: its ledger and details follow", () => {
    const { presenter, latest } = createPresented(createSmallSeed());

    presenter.select("la21");

    expect(latest().selectedNode?.key).toBe("la21");
    expect(latest().ledger?.lines.map(numberOf)).toEqual([1]);
    expect(latest().details).toMatchObject({
      path: "Total › Costs › Spese generali › Ascensore",
      typeLabel: "Movable",
      natureLabel: "Cost",
      isCost: true,
      budget: 100000,
      systemId: "21",
    });
  });

  it("labels a supplier row and an owner residency row as subledgers", () => {
    const { presenter, latest } = createPresented(createSmallSeed());

    presenter.select("la4@assets/md2");
    expect(latest().details?.typeLabel).toBe("Non-movable / subledger");

    presenter.select("la5@assets/md10/r1");
    expect(latest().details?.typeLabel).toBe("Non-movable / owner subledger");
  });

  it("errors, naming the key, for a node the tree does not have", () => {
    const { presenter, errors } = createPresented(createSmallSeed());

    presenter.select("la99");

    expect([...new Set(errors())]).toEqual(["missing: the node la99"]);
  });

  it("resets the selection to Total when the period changes", () => {
    const { presenter, selected$, latest, errors } = createPresented(
      createSeedWithEmptyPeriod(),
    );

    presenter.select("la21");
    selected$.next({ buildingId: "c1", periodId: "p1" });

    expect(latest().selectedKey).toBe("la21");

    selected$.next({ buildingId: "c2", periodId: "p2" });

    expect(latest().selectedKey).toBe("total");
    expect(amountsOf(latest().tree)).toEqual([
      ["total", 0, 0, 0],
      ["patrimonial", 0, 0, 0],
      ["assets", 0, 0, 0],
      ["liabilities", 0, 0, 0],
      ["costs", 0, 0, 0],
      ["revenue", 0, 0, 0],
    ]);
    expect(latest().ledger).toEqual({
      lines: [],
      totalDebit: 0,
      totalCredit: 0,
      balance: 0,
    });
    expect(latest().details?.path).toBe("Total");
    expect(errors()).toEqual([]);
  });

  it("a budget edit through the presenter shows in the tree", async () => {
    const { presenter, latest } = createPresented(createSmallSeed());

    expect(await presenter.setBudget("la21", cents(120000))).toEqual({
      ok: true,
    });
    expect(findNode(mustTree(latest().tree), "la20")?.budget).toBe(170000);

    expect(await presenter.setBudget("la20", cents(1))).toEqual({
      ok: false,
      reason: "not-a-leaf",
    });
  });

  it("does not re-emit the same key when only the books change", async () => {
    const { presenter, keys } = createPresented(createSmallSeed());

    presenter.select("la21");
    await presenter.setBudget("la21", cents(120000));

    expect(keys()).toEqual(["total", "la21"]);
  });

  it("answers null for everything while no period is selected", () => {
    const { latest } = createPresented(createSmallSeed(), null);

    expect(latest()).toEqual({
      tree: null,
      selectedKey: "total",
      selectedNode: null,
      ledger: null,
      details: null,
    });
  });
});

interface Latest {
  tree: AccountNode | null;
  selectedKey: string;
  selectedNode: AccountNode | null;
  ledger: Ledger | null;
  details: AccountDetails | null;
}

interface Presented {
  presenter: AccountsPresenter;
  selected$: BehaviorSubject<PeriodSelection | null>;
  latest: () => Latest;
  errors: () => string[];
  /** Every key selectedKey$ emitted, in order. */
  keys: () => string[];
}

const POZZETTO_2013: PeriodSelection = { buildingId: "c1", periodId: "p1" };

/** The presenter over the seed's books on the period, given the tables (the seed's, unless others are given). */
function createPresented(
  seed: LegacySeed,
  initial: PeriodSelection | null = POZZETTO_2013,
  tables: ThousandthTable[] = seed.tables,
): Presented {
  const selected$ = new BehaviorSubject<PeriodSelection | null>(initial);
  const accounts = createAccountsSimulator(seed);
  const books = createBooksPresenter(
    {
      accounts,
      journal: createJournalSimulator(seed, fixedClock("2026-10-14T08:00:00Z")),
      installments: createInstallmentsSimulator(seed),
    },
    selected$,
    of(seed.buildings),
  );
  const presenter = createAccountsPresenter(books.books$, accounts, of(tables));

  const latest: Latest = {
    tree: null,
    selectedKey: "",
    selectedNode: null,
    ledger: null,
    details: null,
  };
  const errors: string[] = [];
  const keys: string[] = [];

  function recordError(error: Error): void {
    errors.push(error.message);
  }

  presenter.tree$.subscribe({
    next: (next: AccountNode | null) => {
      latest.tree = next;
    },
    error: recordError,
  });
  presenter.selectedKey$.subscribe({
    next: (next: string) => {
      latest.selectedKey = next;
      keys.push(next);
    },
    error: recordError,
  });
  presenter.selectedNode$.subscribe({
    next: (next: AccountNode | null) => {
      latest.selectedNode = next;
    },
    error: recordError,
  });
  presenter.ledger$.subscribe({
    next: (next: Ledger | null) => {
      latest.ledger = next;
    },
    error: recordError,
  });
  presenter.details$.subscribe({
    next: (next: AccountDetails | null) => {
      latest.details = next;
    },
    error: recordError,
  });

  return {
    presenter,
    selected$,
    latest: () => {
      return latest;
    },
    errors: () => {
      return errors;
    },
    keys: () => {
      return keys;
    },
  };
}

/** A link of la20 to dt2 "Lift" for half the account, shared half and half by PR/NP/LE and CO, with no row for the other two: US/CF holds a percentage, and no row to read it from. */
function createSharedLink(): TableLink {
  return {
    ...createLink("el2", "la20", "dt2", "both"),
    percentage: 5000,
    roles: { 1: 5000, 2: 2500, 3: 5000, 4: null },
    present: { 1: true, 2: false, 3: true, 4: false },
  };
}

/** The small seed, and a second building, Saturno, whose one period has no account and no entry. */
function createSeedWithEmptyPeriod(): LegacySeed {
  const seed = createSmallSeed();
  const period = {
    id: "p2",
    name: "2011",
    type: "ordinary" as const,
    start: "2011-01-01",
    end: "2011-12-31",
    closed: false,
  };

  return {
    ...seed,
    buildings: [
      ...seed.buildings,
      { id: "c2", name: "Saturno", periods: [period] },
    ],
  };
}

type Amounts = [string, number, number, number];

function amountsOf(node: AccountNode | null): Amounts[] {
  if (node === null) {
    return [];
  }

  return [
    [node.key, node.debit, node.credit, node.balance],
    ...node.children.flatMap(amountsOf),
  ];
}

function mustTree(tree: AccountNode | null): AccountNode {
  if (tree === null) {
    throw new Error("missing: the tree");
  }

  return tree;
}

function keyOf(node: AccountNode): string {
  return node.key;
}

function numberOf(line: Ledger["lines"][number]): number {
  return line.number;
}
