import { BehaviorSubject, of } from "rxjs";
import { describe, expect, it } from "vitest";

import {
  type Building,
  cents,
  createAccountsSimulator,
  createJournalSimulator,
  type EntryDraft,
  fixedClock,
  type JournalEntryView,
  type LegacySeed,
} from "@cl/domain";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";
import { createTwoPeriodSeed } from "@cl/domain/testing/createTwoPeriodSeed.ts";

import { createBooksPresenter } from "./booksPresenter.ts";
import type { PeriodSelection } from "./buildingsPresenter.ts";
import {
  createJournalPresenter,
  type JournalContext,
  type JournalPresenter,
} from "./journalPresenter.ts";

describe("the journal presenter", () => {
  it("answers the selected period's entries as the grid shows them, in number order", () => {
    const { latest } = createPresented(POZZETTO_2013);

    expect(latest().entries.map(numberOf)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(latest().entries[0]?.postings[1]).toEqual({
      key: "la4/md1",
      path: "Total › Patrimonial › Fornitori › Alfa s.n.c.",
      debit: 0,
      credit: 36018,
      balance: 0,
    });
  });

  it("names the building and the period for the wizards", () => {
    const { latest } = createPresented(POZZETTO_2013);

    expect(latest().context).toEqual({ building: "Pozzetto", period: "2013" });
  });

  it("follows the selection to another period: its entries and its name", () => {
    const { selected$, latest } = createPresented(
      POZZETTO_2013,
      createTwoPeriodSeed(),
    );

    selected$.next({ buildingId: "c1", periodId: "p2" });

    expect(latest().entries.map(idOf)).toEqual(["x-e1"]);
    expect(latest().context).toEqual({ building: "Pozzetto", period: "2014" });
  });

  it("answers nothing with no period selected, and refuses to add", async () => {
    const { presenter, latest } = createPresented(null);

    expect(latest()).toEqual({ entries: [], context: null });
    expect(await presenter.addEntry(createDraft())).toEqual({
      ok: false,
      reason: "no-period",
    });
  });

  it("names no context while the buildings do not have the period", () => {
    const { latest } = createPresented(POZZETTO_2013, createSmallSeed(), []);

    expect(latest().context).toBeNull();
  });

  it("adds to the selected period and the entries follow", async () => {
    const { presenter, latest } = createPresented(POZZETTO_2013);

    expect(await presenter.addEntry(createDraft())).toEqual({
      ok: true,
      value: { id: "new1" },
    });
    expect(latest().entries.at(-1)).toMatchObject({
      id: "new1",
      number: 10,
      at: "2026-10-14T10:00:00",
      kind: "generic",
    });
  });

  it("adds to the period selected at the time of the call", async () => {
    const { presenter, selected$, latest } = createPresented(null);

    selected$.next(POZZETTO_2013);

    expect(await presenter.addEntry(createDraft())).toEqual({
      ok: true,
      value: { id: "new1" },
    });
    expect(latest().entries).toHaveLength(10);
  });

  it("deletes and the numbering closes", async () => {
    const { presenter, latest } = createPresented(POZZETTO_2013);

    expect(await presenter.deleteEntry("e6")).toEqual({ ok: true });
    expect(latest().entries.map(numberOf)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(await presenter.deleteEntry("e4")).toEqual({
      ok: false,
      reason: "kind-not-deletable",
    });
  });

  it("replaces an entry through the port, in place, and the entries follow", async () => {
    const { presenter, latest } = createPresented(POZZETTO_2013);

    expect(await presenter.replaceEntry("e6", createDraft())).toEqual({
      ok: true,
    });
    expect(latest().entries.find(isEntry("e6"))).toMatchObject({
      number: 6,
      description: "Prova",
      debit: 100,
    });
    expect(await presenter.replaceEntry("e4", createDraft())).toEqual({
      ok: false,
      reason: "kind-not-editable",
    });
  });

  it("refuses to replace with no period selected", async () => {
    const { presenter } = createPresented(null);

    expect(await presenter.replaceEntry("e6", createDraft())).toEqual({
      ok: false,
      reason: "no-period",
    });
  });
});

interface Latest {
  entries: JournalEntryView[];
  context: JournalContext | null;
}

interface Presented {
  presenter: JournalPresenter;
  selected$: BehaviorSubject<PeriodSelection | null>;
  latest: () => Latest;
}

const POZZETTO_2013: PeriodSelection = { buildingId: "c1", periodId: "p1" };

function createPresented(
  initial: PeriodSelection | null,
  seed: LegacySeed = createSmallSeed(),
  buildings: Building[] = seed.buildings,
): Presented {
  const selected$ = new BehaviorSubject<PeriodSelection | null>(initial);
  const journal = createJournalSimulator(
    seed,
    fixedClock("2026-10-14T08:00:00Z"),
  );

  const books = createBooksPresenter(
    { accounts: createAccountsSimulator(seed), journal },
    selected$,
    of(buildings),
  );

  const presenter = createJournalPresenter(
    books.books$,
    of(buildings),
    selected$,
    journal,
  );
  const latest: Latest = { entries: [], context: null };

  presenter.entries$.subscribe((next) => {
    latest.entries = next;
  });
  presenter.context$.subscribe((next) => {
    latest.context = next;
  });

  return {
    presenter,
    selected$,
    latest: () => {
      return latest;
    },
  };
}

/** A balanced generic entry on the small books: the lift's cost paid in cash. */
function createDraft(): EntryDraft {
  return {
    kind: "generic",
    description: "Prova",
    postings: [
      {
        accountId: "la21",
        debit: cents(100),
        credit: cents(0),
        counterpart: null,
      },
      {
        accountId: "la1",
        debit: cents(0),
        credit: cents(100),
        counterpart: null,
      },
    ],
  };
}

function numberOf(entry: JournalEntryView): number {
  return entry.number;
}

function idOf(entry: JournalEntryView): string {
  return entry.id;
}

function isEntry(id: string): (entry: JournalEntryView) => boolean {
  return (entry: JournalEntryView): boolean => {
    return entry.id === id;
  };
}
