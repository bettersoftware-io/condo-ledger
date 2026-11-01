import { type DefaultedStateObservable, state } from "@rx-state/core";
import {
  BehaviorSubject,
  combineLatest,
  map,
  type Observable,
  of,
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
};

/**
 * The Contacts screen's state: the registry filtered, paged and selected.
 * The selection is held by id and read against the page: one the filter or
 * the page no longer lists falls to the page's first row. A page past the end
 * becomes the last. The page does not follow a contact that a rename moves;
 * `reveal` does, after a save.
 */
export function createContactsPresenter(
  ports: ContactsPresenterPorts,
): ContactsPresenter {
  const preferences$ = new BehaviorSubject<Preferences>(INITIAL);
  const typed$ = new BehaviorSubject<string>("");
  let latest: Data | null = null;
  const data$: Observable<Data> = combineLatest([
    ports.contacts.contacts(),
    ports.contacts.categories(),
    ports.contacts.uses(),
    ports.buildings.buildings(),
  ]).pipe(
    map(([contacts, categories, uses, buildings]): Data => {
      const data = {
        views: contactViewsOf(contacts, categories),
        categories,
        uses,
        buildings,
      };

      latest = data;

      return data;
    }),
  );

  const stage$ = combineLatest([data$, preferences$]).pipe(
    map(([data, preferences]) => {
      return stageOf(data, preferences);
    }),
  );

  const withConnections$ = stage$.pipe(
    switchMap((stage) => {
      const { selected } = stage.view;

      if (selected === null) {
        return of({ stage, connections: [] });
      }

      return ports.contacts.connections(selected.id).pipe(
        map((connections) => {
          return { stage, connections };
        }),
      );
    }),
  );

  function update(change: Partial<Preferences>): void {
    preferences$.next({ ...preferences$.getValue(), ...change });
  }

  function filterTo(filter: ContactFilter): void {
    update({ filter, selectedId: null, page: 1 });
  }

  return {
    view$: state(
      combineLatest([withConnections$, typed$]).pipe(
        map(([{ stage, connections }, typedKeyword]): ContactsView => {
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
      if (latest === null) {
        return;
      }

      const { views, uses } = latest;

      if (!views.some(isContact(id))) {
        return;
      }

      const { filter, pageSize } = preferences$.getValue();
      const listed = filterViews(views, filter, uses);
      const hidden = !listed.some(isContact(id));

      if (hidden) {
        typed$.next("");
      }

      const shown = hidden ? views : listed;

      update({
        filter: hidden ? ALL_CONTACTS : filter,
        selectedId: id,
        page: pageOfIndex(shown.findIndex(isContact(id)), pageSize),
      });
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
