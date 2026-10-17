import { type DefaultedStateObservable, state } from "@rx-state/core";
import { combineLatest, map, type Observable } from "rxjs";

import {
  type Building,
  type EntryAdded,
  type EntryDraft,
  type JournalEntryView,
  type JournalPort,
  journalOf,
  type Result,
  type ResultOf,
  rejected,
} from "@cl/domain";

import type { Books } from "./booksPresenter.ts";
import type { PeriodSelection } from "./buildingsPresenter.ts";

/** What every wizard shows first: the building and the period the entry goes to. */
export interface JournalContext {
  building: string;
  period: string;
}

export interface JournalPresenter {
  entries$: DefaultedStateObservable<JournalEntryView[]>;
  context$: DefaultedStateObservable<JournalContext | null>;
  /** On the selected period; refused with `no-period` when none is. */
  addEntry: (draft: EntryDraft) => Promise<ResultOf<EntryAdded>>;
  /** Rewrites the entry in place; refused with `no-period` when no period is selected. */
  replaceEntry: (id: string, draft: EntryDraft) => Promise<Result>;
  deleteEntry: (id: string) => Promise<Result>;
}

/** The Journal screen: the selected period's entries as the grid shows them, and the commands on it. */
export function createJournalPresenter(
  books$: Observable<Books | null>,
  buildings$: Observable<Building[]>,
  selected$: Observable<PeriodSelection | null>,
  port: JournalPort,
): JournalPresenter {
  let current: PeriodSelection | null = null;

  // The presenter lives as long as the application: nothing disposes it.
  selected$.subscribe((selection) => {
    current = selection;
  });

  return {
    entries$: state(
      books$.pipe(
        map((books) => {
          return books === null ? [] : journalOf(books.tree, books.entries);
        }),
      ),
      [],
    ),
    context$: state(
      combineLatest([buildings$, selected$]).pipe(
        map(([buildings, selection]) => {
          return contextOf(buildings, selection);
        }),
      ),
      null,
    ),
    addEntry: (draft: EntryDraft): Promise<ResultOf<EntryAdded>> => {
      return current === null
        ? Promise.resolve(rejected("no-period"))
        : port.addEntry(current.periodId, draft);
    },
    replaceEntry: (id: string, draft: EntryDraft): Promise<Result> => {
      return current === null
        ? Promise.resolve(rejected("no-period"))
        : port.replaceEntry(id, draft);
    },
    deleteEntry: (id: string): Promise<Result> => {
      return port.deleteEntry(id);
    },
  };
}

function contextOf(
  buildings: Building[],
  selection: PeriodSelection | null,
): JournalContext | null {
  if (selection === null) {
    return null;
  }

  for (const building of buildings) {
    for (const period of building.periods) {
      if (period.id === selection.periodId) {
        return { building: building.name, period: period.name };
      }
    }
  }

  return null;
}
