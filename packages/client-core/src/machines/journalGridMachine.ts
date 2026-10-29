import { type DefaultedStateObservable, state } from "@rx-state/core";
import {
  BehaviorSubject,
  combineLatest,
  map,
  NEVER,
  type Observable,
} from "rxjs";

import type { JournalEntryView, PostingView } from "@cl/domain";

import type { Machine } from "./machine.ts";

export type PageSize = 10 | 25 | 50 | 100;

export const PAGE_SIZES: readonly PageSize[] = [10, 25, 50, 100];

interface EntryRow {
  kind: "entry";
  entry: JournalEntryView;
  expanded: boolean;
  selected: boolean;
}

interface PostingRow {
  kind: "posting";
  entryId: string;
  index: number;
  posting: PostingView;
  last: boolean;
}

export type JournalGridRow = EntryRow | PostingRow;

export interface JournalGridState {
  rows: JournalGridRow[];
  selectedId: string | null;
  expanded: string[];
  search: string;
  page: number;
  pageSize: PageSize;
  pageCount: number;
  /** The entries after the search. */
  total: number;
}

export interface JournalGridIntents {
  select: (id: string) => void;
  toggle: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setSearch: (text: string) => void;
  setPage: (page: number) => void;
  setPageSize: (size: PageSize) => void;
  /** The page that holds the entry, selected: what a saved entry gets. A search that hides the entry is cleared first; unknown ids change nothing. */
  reveal: (id: string) => void;
}

interface Preferences {
  selectedId: string | null;
  expanded: ReadonlySet<string>;
  search: string;
  page: number;
  pageSize: PageSize;
}

const INITIAL: Preferences = {
  selectedId: null,
  expanded: new Set(),
  search: "",
  page: 1,
  pageSize: 10,
};

/**
 * What the Journal grid shows of the presenter's entries: the page, the open
 * entries, the search and the selection. The state is
 * reconciled with the entries on every emission: a selected or open entry
 * that is gone is dropped, a page past the end becomes the last. Each
 * emission of `restart$` goes back to the first page, with nothing open or
 * selected, and keeps the search and the page size.
 */
export function createJournalGridMachine(
  entries$: Observable<JournalEntryView[]>,
  restart$: Observable<unknown> = NEVER,
): Machine<JournalGridState, JournalGridIntents> {
  const preferences$ = new BehaviorSubject<Preferences>(INITIAL);
  const latest = new BehaviorSubject<JournalEntryView[]>([]);
  const state$: DefaultedStateObservable<JournalGridState> = state(
    combineLatest([entries$, preferences$]).pipe(
      map(([entries, preferences]) => {
        latest.next(entries);

        return stateOf(entries, preferences);
      }),
    ),
    stateOf([], INITIAL),
  );
  const subscription = state$.subscribe();
  const restarts = restart$.subscribe(() => {
    update({ selectedId: null, expanded: new Set(), page: 1 });
  });

  function update(change: Partial<Preferences>): void {
    preferences$.next({ ...preferences$.getValue(), ...change });
  }

  function visible(): JournalEntryView[] {
    return matching(latest.getValue(), preferences$.getValue().search);
  }

  return {
    state$,
    intents: {
      select: (id: string): void => {
        update({ selectedId: id });
      },
      toggle: (id: string): void => {
        const expanded = new Set(preferences$.getValue().expanded);

        if (!expanded.delete(id)) {
          expanded.add(id);
        }

        update({ expanded });
      },
      expandAll: (): void => {
        update({ expanded: new Set(visible().map(idOf)) });
      },
      collapseAll: (): void => {
        update({ expanded: new Set() });
      },
      setSearch: (text: string): void => {
        update({ search: text, page: 1 });
      },
      setPage: (page: number): void => {
        update({ page });
      },
      setPageSize: (size: PageSize): void => {
        update({ pageSize: size, page: 1 });
      },
      reveal: (id: string): void => {
        if (!latest.getValue().some(isEntry(id))) {
          return;
        }

        const search = visible().some(isEntry(id))
          ? preferences$.getValue().search
          : "";

        const index = matching(latest.getValue(), search).findIndex(
          isEntry(id),
        );

        update({
          search,
          selectedId: id,
          page: Math.floor(index / preferences$.getValue().pageSize) + 1,
        });
      },
    },
    dispose: (): void => {
      restarts.unsubscribe();
      subscription.unsubscribe();
      preferences$.complete();
    },
  };
}

function stateOf(
  entries: JournalEntryView[],
  preferences: Preferences,
): JournalGridState {
  const found = matching(entries, preferences.search);
  const ids = new Set(found.map(idOf));
  const pageCount = Math.max(1, Math.ceil(found.length / preferences.pageSize));
  const page = Math.min(Math.max(1, preferences.page), pageCount);
  const expanded = [...preferences.expanded].filter((id) => {
    return ids.has(id);
  });

  const selectedId =
    preferences.selectedId !== null && ids.has(preferences.selectedId)
      ? preferences.selectedId
      : null;
  const open = new Set(expanded);
  const rows = found
    .slice((page - 1) * preferences.pageSize, page * preferences.pageSize)
    .flatMap((entry): JournalGridRow[] => {
      const isOpen = open.has(entry.id);
      const row: JournalGridRow = {
        kind: "entry",
        entry,
        expanded: isOpen,
        selected: entry.id === selectedId,
      };

      if (!isOpen) {
        return [row];
      }

      return [
        row,
        ...entry.postings.map((posting, index): JournalGridRow => {
          return {
            kind: "posting",
            entryId: entry.id,
            index,
            posting,
            last: index === entry.postings.length - 1,
          };
        }),
      ];
    });

  return {
    rows,
    selectedId,
    expanded,
    search: preferences.search,
    page,
    pageSize: preferences.pageSize,
    pageCount,
    total: found.length,
  };
}

/** The entries whose description holds the text, or whose number is the text; every entry for a blank search. */
function matching(
  entries: JournalEntryView[],
  search: string,
): JournalEntryView[] {
  const needle = search.trim().toLocaleLowerCase("it");

  if (needle === "") {
    return entries;
  }

  return entries.filter((entry) => {
    return (
      String(entry.number) === needle ||
      entry.description.toLocaleLowerCase("it").includes(needle)
    );
  });
}

function idOf(entry: JournalEntryView): string {
  return entry.id;
}

function isEntry(id: string): (entry: JournalEntryView) => boolean {
  return (entry: JournalEntryView): boolean => {
    return entry.id === id;
  };
}
