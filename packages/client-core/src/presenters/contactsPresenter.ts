import { type DefaultedStateObservable, state } from "@rx-state/core";
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  type Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
} from "rxjs";

import {
  ALL_CONTACTS,
  type Building,
  type BuildingsPort,
  type ContactCategory,
  type ContactConnection,
  type ContactFilter,
  type ContactsPort,
  type ContactUsesById,
  type ContactView,
  contactViewsOf,
  filterContacts,
  type Result,
} from "@cl/domain";

import {
  clampPage,
  type PageSize,
  pageCountOf,
  pageOfIndex,
} from "../paging.ts";

/** A category with the number of contacts in it, of all the contacts. */
interface CategoryCount {
  category: ContactCategory;
  count: number;
}

/** The buildings, by name, where the selected contact is used. */
interface ContactUsesView {
  supplierOf: string[];
  residentOf: string[];
  onInvoicesOf: string[];
  inEntriesOf: string[];
}

/** A connection of the selected contact, with the contact it names. */
interface ConnectionView {
  connection: ContactConnection;
  connected: ContactView;
}

/** The Contacts screen: the filters, the categories, the page of the list, and what the sheet and the Connected Contacts tab show of the selected contact. */
export interface ContactsView {
  /** The filter applied: its keyword is the one searched, not the one typed. */
  filter: ContactFilter;
  typedKeyword: string;
  /** Every category by name, with its count of all contacts, whatever the filter. */
  categories: CategoryCount[];
  allCount: number;
  /** The page's contacts. */
  rows: ContactView[];
  page: number;
  pageSize: PageSize;
  /** At least 1. */
  pageCount: number;
  /** The contacts the filter lets through. */
  total: number;
  /** The row chosen while the page lists it; else the page's first row. Null when nothing is listed. */
  selected: ContactView | null;
  /** Where the selected contact is used; null with no selection. */
  uses: ContactUsesView | null;
  /** The selected contact's connections, by order. */
  connections: ConnectionView[];
}

export interface ContactsPresenter {
  /** Null until the contacts, categories, uses and buildings have answered. */
  view$: DefaultedStateObservable<ContactsView | null>;
  typeKeyword: (text: string) => void;
  /** Applies the typed keyword. */
  search: () => void;
  /** Applies at once, from page 1. */
  setFilter: (patch: Partial<Omit<ContactFilter, "keyword">>) => void;
  /** Restores every filter and empties the typed keyword; the page size stays. */
  reset: () => void;
  setPage: (page: number) => void;
  setPageSize: (size: PageSize) => void;
  select: (id: string) => void;
  /** The page that holds the contact, selected: what a saved contact gets, since a rename moves it. A filter that hides it is reset first; unknown ids change nothing. */
  reveal: (id: string) => void;
  /** Deletes the category; refused while a contact is in it. Deleting the one the list is filtered to takes the filter back to every category. */
  deleteCategory: (id: string) => Promise<Result>;
}

export interface ContactsPresenterPorts {
  contacts: ContactsPort;
  buildings: BuildingsPort;
}

interface Preferences {
  filter: ContactFilter;
  selectedId: string | null;
  page: number;
  pageSize: PageSize;
  /** A contact to show as soon as the registry holds it; any other choice of the person drops it. */
  pendingReveal: string | null;
}

/** The preferences once a reveal is applied, and whether the filter had to go for it. */
interface Revealed {
  preferences: Preferences;
  hidden: boolean;
}

/** The connections asked of one contact, with the contact they were asked of. */
interface Asked {
  contactId: string | null;
  connections: ContactConnection[];
}

interface Data {
  views: ContactView[];
  categories: ContactCategory[];
  uses: ContactUsesById;
  buildings: Building[];
}

/** The view but for the connections, which come from the port, and the typed keyword. */
interface Stage {
  view: Omit<ContactsView, "connections" | "typedKeyword">;
  views: ContactView[];
}

const INITIAL: Preferences = {
  filter: ALL_CONTACTS,
  selectedId: null,
  page: 1,
  pageSize: 10,
  pendingReveal: null,
};

/**
 * The Contacts screen's state: the registry filtered, paged and selected.
 * The selection is held by id and read against the page: one the filter or
 * the page no longer lists falls to the page's first row. A page past the end
 * becomes the last. The page does not follow a contact that a rename moves;
 * `reveal` does, after a save: it waits, if need be, for the contact to reach the registry.
 */
export function createContactsPresenter(
  ports: ContactsPresenterPorts,
): ContactsPresenter {
  const preferences$ = new BehaviorSubject<Preferences>(INITIAL);
  const typed$ = new BehaviorSubject<string>("");
  const data$: Observable<Data> = combineLatest([
    ports.contacts.contacts(),
    ports.contacts.categories(),
    ports.contacts.uses(),
    ports.buildings.buildings(),
  ]).pipe(
    map(([contacts, categories, uses, buildings]): Data => {
      return {
        views: contactViewsOf(contacts, categories),
        categories,
        uses,
        buildings,
      };
    }),
  );

  const stage$ = combineLatest([data$, preferences$]).pipe(
    map(([data, preferences]) => {
      const revealed = revealedBy(data, preferences);

      if (revealed === null) {
        return stageOf(data, preferences);
      }

      // The reveal is settled into the preferences, which emit again with it
      // applied; this emission is the stale one.
      if (revealed.hidden) {
        typed$.next("");
      }

      preferences$.next(revealed.preferences);

      return null;
    }),
    filter((stage): stage is Stage => {
      return stage !== null;
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // Keyed on the selected contact: a filter or a page that keeps it asks again of nothing.
  const asked$: Observable<Asked> = stage$.pipe(
    map((stage) => {
      return stage.view.selected?.id ?? null;
    }),
    distinctUntilChanged(),
    switchMap((contactId): Observable<Asked> => {
      if (contactId === null) {
        return of({ contactId, connections: [] });
      }

      return ports.contacts.connections(contactId).pipe(
        map((connections) => {
          return { contactId, connections };
        }),
      );
    }),
    startWith({ contactId: null, connections: [] } satisfies Asked),
  );

  function update(change: Partial<Preferences>): void {
    preferences$.next({
      ...preferences$.getValue(),
      pendingReveal: null,
      ...change,
    });
  }

  function filterTo(filter: ContactFilter): void {
    update({ filter, selectedId: null, page: 1 });
  }

  return {
    view$: state(
      combineLatest([stage$, asked$, typed$]).pipe(
        map(([stage, asked, typedKeyword]): ContactsView => {
          const connections =
            asked.contactId === stage.view.selected?.id
              ? asked.connections
              : [];

          return {
            ...stage.view,
            typedKeyword,
            connections: connectionViewsOf(connections, stage.views),
          };
        }),
      ),
      null,
    ),
    typeKeyword: (text: string): void => {
      typed$.next(text);
    },
    search: (): void => {
      filterTo({
        ...preferences$.getValue().filter,
        keyword: typed$.getValue(),
      });
    },
    setFilter: (patch: Partial<Omit<ContactFilter, "keyword">>): void => {
      filterTo({ ...preferences$.getValue().filter, ...patch });
    },
    reset: (): void => {
      typed$.next("");
      filterTo(ALL_CONTACTS);
    },
    setPage: (page: number): void => {
      update({ page, selectedId: null });
    },
    setPageSize: (size: PageSize): void => {
      update({ pageSize: size, page: 1, selectedId: null });
    },
    select: (id: string): void => {
      update({ selectedId: id });
    },
    reveal: (id: string): void => {
      update({ pendingReveal: id });
    },
    deleteCategory: async (id: string): Promise<Result> => {
      const result = await ports.contacts.deleteCategory(id);
      const { filter } = preferences$.getValue();

      if (result.ok && filter.categoryId === id) {
        filterTo({ ...filter, categoryId: null });
      }

      return result;
    },
  };
}

/**
 * The preferences with the pending reveal applied, once the registry holds the
 * contact: the filter back to every contact when it hides it, the page that
 * holds it, and it selected. Null with nothing pending or the contact not yet
 * here.
 */
function revealedBy(data: Data, preferences: Preferences): Revealed | null {
  const id = preferences.pendingReveal;

  if (id === null || !data.views.some(isContact(id))) {
    return null;
  }

  const listed = filterViews(data.views, preferences.filter, data.uses);
  const hidden = !listed.some(isContact(id));
  const shown = hidden ? data.views : listed;

  return {
    hidden,
    preferences: {
      ...preferences,
      filter: hidden ? ALL_CONTACTS : preferences.filter,
      selectedId: id,
      page: pageOfIndex(shown.findIndex(isContact(id)), preferences.pageSize),
      pendingReveal: null,
    },
  };
}

function stageOf(data: Data, preferences: Preferences): Stage {
  const { views, categories, uses, buildings } = data;
  const { filter, pageSize } = preferences;
  const listed = filterViews(views, filter, uses);
  const pageCount = pageCountOf(listed.length, pageSize);
  const page = clampPage(preferences.page, pageCount);
  const rows = listed.slice((page - 1) * pageSize, page * pageSize);
  const selected =
    rows.find((row) => {
      return row.id === preferences.selectedId;
    }) ??
    rows[0] ??
    null;

  return {
    views,
    view: {
      filter,
      categories: categoryCountsOf(categories, views),
      allCount: views.length,
      rows,
      page,
      pageSize,
      pageCount,
      total: listed.length,
      selected,
      uses: selected === null ? null : usesViewOf(selected.id, uses, buildings),
    },
  };
}

function filterViews(
  views: ContactView[],
  filter: ContactFilter,
  uses: ContactUsesById,
): ContactView[] {
  const allowed = new Set(
    filterContacts(
      views.map((view) => {
        return view.contact;
      }),
      filter,
      uses,
    ).map((contact) => {
      return contact.id;
    }),
  );

  return views.filter((view) => {
    return allowed.has(view.id);
  });
}

function categoryCountsOf(
  categories: ContactCategory[],
  views: ContactView[],
): CategoryCount[] {
  return [...categories]
    .sort((a, b) => {
      return a.name.localeCompare(b.name, "it") || a.id.localeCompare(b.id);
    })
    .map((category): CategoryCount => {
      return {
        category,
        count: views.filter((view) => {
          return view.contact.categoryId === category.id;
        }).length,
      };
    });
}

function usesViewOf(
  contactId: string,
  uses: ContactUsesById,
  buildings: Building[],
): ContactUsesView {
  const found = uses.get(contactId);
  const names = new Map(
    buildings.map((building) => {
      return [building.id, building.name];
    }),
  );

  function named(ids: string[] | undefined): string[] {
    return (ids ?? []).map((id) => {
      return names.get(id) ?? id;
    });
  }

  return {
    supplierOf: named(found?.supplierOf),
    residentOf: named(found?.residentOf),
    onInvoicesOf: named(found?.onInvoicesOf),
    inEntriesOf: named(found?.inEntriesOf),
  };
}

/** The connections by order, each with the contact it names; one naming a contact the registry lacks is left out. */
function connectionViewsOf(
  connections: ContactConnection[],
  views: ContactView[],
): ConnectionView[] {
  return [...connections]
    .sort((a, b) => {
      return a.order - b.order || a.id.localeCompare(b.id);
    })
    .flatMap((connection): ConnectionView[] => {
      const connected = views.find(isContact(connection.connectedId));

      return connected === undefined ? [] : [{ connection, connected }];
    });
}

function isContact(id: string): (view: ContactView) => boolean {
  return (view: ContactView): boolean => {
    return view.id === id;
  };
}
