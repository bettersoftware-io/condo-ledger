import { BehaviorSubject } from "rxjs";
import { describe, expect, it } from "vitest";

import {
  createAccountsSimulator,
  createJournalSimulator,
  type JournalEntry,
} from "@cl/domain";
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
    expect(latest()?.accounts).toHaveLength(12);
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
  ports: BooksPresenterPorts;
  latest: () => Books | null;
}

function createPresented(initial: PeriodSelection | null): Presented {
  const seed = createTwoPeriodSeed();
  const selected$ = new BehaviorSubject<PeriodSelection | null>(initial);
  const ports: BooksPresenterPorts = {
    accounts: createAccountsSimulator(seed),
    journal: createJournalSimulator(seed),
  };
  const presenter = createBooksPresenter(ports, selected$);
  let latest: Books | null = null;

  presenter.books$.subscribe((next) => {
    latest = next;
  });

  return {
    selected$,
    ports,
    latest: () => {
      return latest;
    },
  };
}

function numberOf(entry: JournalEntry): number {
  return entry.number;
}

function idOf(entry: JournalEntry): string {
  return entry.id;
}
