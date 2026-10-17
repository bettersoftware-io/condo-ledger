import { BehaviorSubject } from "rxjs";
import { describe, expect, it } from "vitest";

import {
  type Building,
  createAccountsSimulator,
  createJournalSimulator,
  type JournalEntry,
  type LegacySeed,
  loadLegacySeed,
  type WithholdingTax,
} from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";
import { createTwoPeriodSeed } from "@cl/domain/testing/createTwoPeriodSeed.ts";

import {
  type Books,
  type BooksPresenterPorts,
  createBooksPresenter,
} from "./booksPresenter.ts";
import type { PeriodSelection } from "./buildingsPresenter.ts";

describe("the books presenter", () => {
  it("reads the selected period's accounts, parties, entries and tree together", () => {
    const { latest } = createPresented({ buildingId: "c1", periodId: "p1" });

    expect(latest()?.periodId).toBe("p1");
    expect(latest()?.accounts).toHaveLength(13);
    expect(latest()?.entries.map(numberOf)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(latest()?.tree.debit).toBe(212619);
  });

  it("switches to another period's books, and to null with no selection", () => {
    const { selected$, latest } = createPresented({
      buildingId: "c1",
      periodId: "p1",
    });

    selected$.next({ buildingId: "c1", periodId: "p2" });
    expect(latest()?.periodId).toBe("p2");
    expect(latest()?.entries.map(idOf)).toEqual(["x-e1"]);

    selected$.next(null);
    expect(latest()).toBeNull();
  });

  it("carries the period's invoices, withholding catalogue and dates, and switches with the period", () => {
    const { selected$, latest } = createPresented(
      { buildingId: "c19", periodId: "p36" },
      loadLegacySeed(legacySeedData),
    );

    expect(latest()?.invoices).toHaveLength(47);
    expect(
      latest()?.withholdingTaxes.map((tax) => {
        return `${tax.code}:${tax.accountId}`;
      }),
    ).toEqual(["1004:la166", "1019:la167", "1020:la168", "1040:la165"]);
    expect(latest()?.period).toEqual({
      start: "2013-01-01",
      end: "2013-12-31",
    });

    selected$.next({ buildingId: "c1", periodId: "p1" });

    expect(latest()?.invoices).toHaveLength(2);
    expect(
      latest()?.invoices.every((invoice) => {
        return invoice.periodId === "p1";
      }),
    ).toBe(true);
    expect(latest()?.withholdingTaxes.map(accountOf)).toEqual([
      "la24",
      "la25",
      "la26",
      "la23",
    ]);
    expect(latest()?.period).toEqual({
      start: "2011-01-01",
      end: "2011-12-31",
    });
  });

  it("answers null for a period the building tree does not hold yet, and the books once it does", () => {
    const seed = createTwoPeriodSeed();
    const { tree$, latest } = createPresented(
      { buildingId: "c1", periodId: "p1" },
      seed,
      [],
    );

    expect(latest()).toBeNull();

    tree$.next(seed.buildings);

    expect(latest()?.periodId).toBe("p1");
    expect(latest()?.period).toEqual({
      start: "2013-01-01",
      end: "2013-12-31",
    });
  });

  it("does not read the books again when the tree emits the same period anew", () => {
    const seed = createTwoPeriodSeed();
    const { tree$, emitted } = createPresented(
      { buildingId: "c1", periodId: "p1" },
      seed,
    );
    const before = emitted();

    tree$.next(structuredClone(seed.buildings));

    expect(emitted()).toBe(before);
  });

  it("emits again when the journal changes", async () => {
    const { ports, latest } = createPresented({
      buildingId: "c1",
      periodId: "p1",
    });

    await ports.journal.deleteEntry("e6");

    expect(latest()?.entries).toHaveLength(8);
    expect(latest()?.tree.debit).toBe(212618);
  });
});

interface Presented {
  selected$: BehaviorSubject<PeriodSelection | null>;
  tree$: BehaviorSubject<Building[]>;
  ports: BooksPresenterPorts;
  latest: () => Books | null;
  /** How many times books$ has emitted. */
  emitted: () => number;
}

function createPresented(
  initial: PeriodSelection | null,
  seed: LegacySeed = createTwoPeriodSeed(),
  tree: Building[] = seed.buildings,
): Presented {
  const selected$ = new BehaviorSubject<PeriodSelection | null>(initial);
  const tree$ = new BehaviorSubject<Building[]>(tree);
  const ports: BooksPresenterPorts = {
    accounts: createAccountsSimulator(seed),
    journal: createJournalSimulator(seed),
  };
  const presenter = createBooksPresenter(ports, selected$, tree$);
  let latest: Books | null = null;
  let emitted = 0;

  presenter.books$.subscribe((next) => {
    latest = next;
    emitted += 1;
  });

  return {
    selected$,
    tree$,
    ports,
    latest: () => {
      return latest;
    },
    emitted: () => {
      return emitted;
    },
  };
}

function numberOf(entry: JournalEntry): number {
  return entry.number;
}

function idOf(entry: JournalEntry): string {
  return entry.id;
}

function accountOf(tax: WithholdingTax): string {
  return tax.accountId;
}
