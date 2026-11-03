import { type DefaultedStateObservable, state } from "@rx-state/core";
import {
  BehaviorSubject,
  combineLatest,
  defer,
  distinctUntilChanged,
  filter,
  map,
  type Observable,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

import {
  type AccountsPort,
  addMonths,
  type Building,
  type BuildingsPort,
  bookDeadlines,
  CALENDARS,
  type CalendarFilters,
  type CalendarId,
  type CalendarPort,
  type ClockPort,
  type Contact,
  type ContactsPort,
  type Deadline,
  deadlinesByDay,
  deadlinesOfDay,
  type InstallmentsPort,
  type JournalPort,
  type MonthWeek,
  manual,
  nameOf,
  sameDayIn,
  weeksOf,
} from "@cl/domain";

import { todayOf } from "../today.ts";

/** The names a deadline's words need, by id; an id they do not know is its own name. */
interface DeadlineNames {
  buildingName: (buildingId: string) => string;
  periodName: (periodId: string) => string;
  /** The supplier's contact's name. */
  supplierName: (contactId: string) => string;
}

/** The Calendar screen: the month shown, its deadlines by day, the selected day's list and deadline, the filters. */
export interface CalendarView {
  /** Rome's today, as read when the Calendar opened or on the latest Today. */
  today: string;
  /** `YYYY-MM`. */
  month: string;
  weeks: MonthWeek[];
  /** The month's shown deadlines by ISO day, each day in the day list's order. */
  byDay: Map<string, Deadline[]>;
  day: string;
  /** The selected day's shown deadlines, in order. */
  dayDeadlines: Deadline[];
  /** The deadline chosen while the day lists it; else the day's first. Null for a day with none shown. */
  selected: Deadline | null;
  filters: CalendarFilters;
  /** Every building, by name: the Building filter's choices. */
  buildings: Building[];
  names: DeadlineNames;
}

/** What the Calendar screen may ask. */
export interface CalendarIntents {
  /** One month back, on the same day number, or the month's last day when it is shorter. */
  previousMonth: () => void;
  nextMonth: () => void;
  /** Reads today again from the clock, and shows and selects it. */
  goToToday: () => void;
  /** Selects the day and its first shown deadline. */
  selectDay: (day: string) => void;
  /** A deadline of the selected day; a line of another day goes through `reveal`. */
  selectDeadline: (id: string) => void;
  toggleCalendar: (id: CalendarId) => void;
  showAllCalendars: () => void;
  showNoCalendars: () => void;
  /** One building's deadlines and those tied to it; null for every deadline. */
  setBuilding: (id: string | null) => void;
  /** Shows the day's month and selects the deadline on it: what a saved deadline gets. */
  reveal: (id: string, day: string) => void;
}

export interface CalendarPresenter extends CalendarIntents {
  /** Null until the deadlines, every period's books, the buildings and the contacts have answered. */
  view$: DefaultedStateObservable<CalendarView | null>;
}

export interface CalendarPresenterPorts {
  calendar: CalendarPort;
  buildings: BuildingsPort;
  installments: InstallmentsPort;
  journal: JournalPort;
  accounts: AccountsPort;
  contacts: ContactsPort;
}

/** Where the Calendar stands: today as read, the month, the day, the chosen deadline and the filters. */
interface Place {
  today: string;
  month: string;
  day: string;
  /** Held by id and read against the day's list, so it survives the books emitting again. */
  selectedId: string | null;
  filters: CalendarFilters;
}

/** A period of a building, as the books are read by. */
interface PeriodOf {
  buildingId: string;
  periodId: string;
}

const EVERY_DEADLINE: CalendarFilters = { hidden: new Set(), buildingId: null };

/**
 * The Calendar's state: the hand-entered deadlines merged with those every
 * period of every building works out from its books, so a write in any period
 * reaches it. Today is read from the clock when the Calendar first opens (the
 * view's first subscriber, or an intent before it) and again on Today, never
 * on a timer. The month, the day, the selection and the filters hold for the
 * application's life.
 */
export function createCalendarPresenter(
  ports: CalendarPresenterPorts,
  clock: ClockPort,
): CalendarPresenter {
  const place$ = new BehaviorSubject<Place | null>(null);
  const buildings$ = ports.buildings
    .buildings()
    .pipe(shareReplay({ bufferSize: 1, refCount: true }));

  const deadlines$: Observable<Deadline[]> = combineLatest([
    ports.calendar.deadlines(),
    booksDeadlinesOf(ports, buildings$),
  ]).pipe(
    map(([typed, books]) => {
      return [...typed.map(manual), ...books];
    }),
  );

  function current(): Place {
    const held = place$.getValue();

    if (held !== null) {
      return held;
    }

    const today = todayOf(clock);
    const opened: Place = {
      today,
      month: monthOf(today),
      day: today,
      selectedId: null,
      filters: EVERY_DEADLINE,
    };

    place$.next(opened);

    return opened;
  }

  function update(change: Partial<Place>): void {
    place$.next({ ...current(), ...change });
  }

  function moveMonths(n: number): void {
    const { month, day } = current();
    const next = addMonths(month, n);

    update({ month: next, day: sameDayIn(day, next), selectedId: null });
  }

  function setHidden(hidden: ReadonlySet<CalendarId>): void {
    update({ filters: { ...current().filters, hidden } });
  }

  return {
    view$: state(
      defer(() => {
        current();

        return combineLatest([
          place$.pipe(
            filter((place): place is Place => {
              return place !== null;
            }),
          ),
          deadlines$,
          buildings$,
          ports.contacts.contacts(),
        ]);
      }).pipe(
        map(([place, deadlines, buildings, contacts]): CalendarView => {
          return viewOf(place, deadlines, buildings, contacts);
        }),
      ),
      null,
    ),
    previousMonth: (): void => {
      moveMonths(-1);
    },
    nextMonth: (): void => {
      moveMonths(1);
    },
    goToToday: (): void => {
      const today = todayOf(clock);

      update({ today, month: monthOf(today), day: today, selectedId: null });
    },
    selectDay: (day: string): void => {
      update({ month: monthOf(day), day, selectedId: null });
    },
    selectDeadline: (id: string): void => {
      update({ selectedId: id });
    },
    toggleCalendar: (id: CalendarId): void => {
      const hidden = new Set(current().filters.hidden);

      if (hidden.has(id)) {
        hidden.delete(id);
      } else {
        hidden.add(id);
      }

      setHidden(hidden);
    },
    showAllCalendars: (): void => {
      setHidden(new Set());
    },
    showNoCalendars: (): void => {
      setHidden(new Set(CALENDARS));
    },
    setBuilding: (id: string | null): void => {
      update({ filters: { ...current().filters, buildingId: id } });
    },
    reveal: (id: string, day: string): void => {
      update({ month: monthOf(day), day, selectedId: id });
    },
  };
}

function viewOf(
  place: Place,
  deadlines: Deadline[],
  buildings: Building[],
  contacts: Contact[],
): CalendarView {
  const dayDeadlines = deadlinesOfDay(deadlines, place.day, place.filters);

  return {
    today: place.today,
    month: place.month,
    weeks: weeksOf(place.month),
    byDay: deadlinesByDay(deadlines, place.month, place.filters),
    day: place.day,
    dayDeadlines,
    selected:
      dayDeadlines.find((deadline) => {
        return deadline.id === place.selectedId;
      }) ??
      dayDeadlines[0] ??
      null,
    filters: place.filters,
    buildings: [...buildings].sort((a, b) => {
      return a.name.localeCompare(b.name, "it") || a.id.localeCompare(b.id);
    }),
    names: namesOf(buildings, contacts),
  };
}

/**
 * The deadlines every period of every building works out from its books,
 * emitting again whenever one period's books do. A period added or removed
 * reads the periods afresh; a rename does not.
 */
function booksDeadlinesOf(
  ports: CalendarPresenterPorts,
  buildings$: Observable<Building[]>,
): Observable<Deadline[]> {
  return buildings$.pipe(
    map(periodsOf),
    distinctUntilChanged(samePeriods),
    switchMap((periods) => {
      if (periods.length === 0) {
        return of([]);
      }

      return combineLatest(
        periods.map((period) => {
          return periodDeadlinesOf(ports, period);
        }),
      ).pipe(
        map((lists) => {
          return lists.flat();
        }),
      );
    }),
  );
}

function periodDeadlinesOf(
  ports: CalendarPresenterPorts,
  { buildingId, periodId }: PeriodOf,
): Observable<Deadline[]> {
  return combineLatest([
    ports.installments.installments(periodId),
    ports.installments.items(periodId),
    ports.journal.entries(periodId),
    ports.journal.invoices(periodId),
    ports.accounts.withholdingTaxes(periodId),
  ]).pipe(
    map(([installments, items, entries, invoices, withholdingTaxes]) => {
      return bookDeadlines({
        buildingId,
        periodId,
        installments,
        items,
        entries,
        invoices,
        withholdingTaxes,
      });
    }),
  );
}

function periodsOf(buildings: Building[]): PeriodOf[] {
  return buildings.flatMap((building) => {
    return building.periods.map((period): PeriodOf => {
      return { buildingId: building.id, periodId: period.id };
    });
  });
}

function samePeriods(a: PeriodOf[], b: PeriodOf[]): boolean {
  return (
    a.length === b.length &&
    a.every((period, index) => {
      const other = b[index];

      return (
        other !== undefined &&
        other.buildingId === period.buildingId &&
        other.periodId === period.periodId
      );
    })
  );
}

function namesOf(buildings: Building[], contacts: Contact[]): DeadlineNames {
  const buildingNames = new Map(
    buildings.map((building) => {
      return [building.id, building.name];
    }),
  );

  const periodNames = new Map(
    buildings.flatMap((building) => {
      return building.periods.map((period) => {
        return [period.id, period.name];
      });
    }),
  );

  const supplierNames = new Map(
    contacts.map((contact) => {
      return [contact.id, nameOf(contact)];
    }),
  );

  return {
    buildingName: (buildingId: string): string => {
      return buildingNames.get(buildingId) ?? buildingId;
    },
    periodName: (periodId: string): string => {
      return periodNames.get(periodId) ?? periodId;
    },
    supplierName: (contactId: string): string => {
      return supplierNames.get(contactId) ?? contactId;
    },
  };
}

function monthOf(day: string): string {
  return day.slice(0, 7);
}
