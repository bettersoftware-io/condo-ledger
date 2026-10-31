import { map, type Observable, switchMap } from "rxjs";

import type {
  AccountNode,
  Allocation,
  AllocationMode,
  CoefficientNode,
  JournalEntryView,
  OwnersRow,
  Schedule,
  UnitsRow,
} from "@cl/domain";

import {
  type AccountsGridIntents,
  type AccountsGridState,
  createAccountsGridMachine,
} from "./machines/accountsGridMachine.ts";
import {
  type AllocationGridState,
  type AllocationModeIntents,
  type AllocationModeState,
  type CoefficientsGridState,
  createAllocationGridMachine,
  createAllocationModeMachine,
  createCoefficientsGridMachine,
  createTableSelectionMachine,
  createTreeGridMachine,
  type TableSelectionIntents,
  type TableSelectionState,
  type TreeGridIntents,
  type TreeGridState,
} from "./machines/allocationMachines.ts";
import {
  type BottomTabIntents,
  type BottomTabState,
  createBottomTabMachine,
} from "./machines/bottomTabMachine.ts";
import {
  type ColumnSpec,
  type ColumnsIntents,
  type ColumnsState,
  createColumnsMachine,
} from "./machines/columnsMachine.ts";
import {
  createJournalGridMachine,
  type JournalGridIntents,
  type JournalGridState,
} from "./machines/journalGridMachine.ts";
import type { Machine } from "./machines/machine.ts";
import {
  createScheduleGridMachine,
  type ScheduleGridIntents,
  type ScheduleGridState,
} from "./machines/scheduleGridMachine.ts";
import {
  createSplitMachine,
  type SplitIntents,
  type SplitState,
} from "./machines/splitMachine.ts";
import type { TableView } from "./presenters/allocationPresenter.ts";
import type { UnitsView } from "./presenters/unitsPresenter.ts";

/** The grids whose columns a person resizes. */
export type GridName =
  | "accounts"
  | "ledger"
  | "journal"
  | "schedule"
  | "tables"
  | "coefficients"
  | "allocation"
  | "units"
  | "unitOwners";

/** The splitters between two panels: the Accounts screen's, the Tables & Allocation screen's two, and the Units screen's. */
export type SplitName =
  | "accounts"
  | "allocationRows"
  | "allocationColumns"
  | "units";

/** The panels with tabs. */
export type TabbedPanelName = "accounts" | "units";

/**
 * What the screens show and how they are laid out, kept for the session: one
 * machine per grid, per grid's columns, per split and per tabbed panel. Each
 * is made lazily, once, on first use, and handed to every asker after, so
 * leaving a screen
 * and coming back finds it as it was left. They live as long as the
 * application and are never disposed. A period switch opens each grid's rows
 * as they start again, since the rows are another period's; the widths, the
 * splits, the tabs and the filters stay.
 */
export interface AppScreens {
  accountsGrid: () => Machine<AccountsGridState, AccountsGridIntents>;
  journalGrid: () => Machine<JournalGridState, JournalGridIntents>;
  scheduleGrid: () => Machine<ScheduleGridState, ScheduleGridIntents>;
  /** Which of the selected period's tables the coefficients show: its first, until one is selected. */
  tableSelection: () => Machine<TableSelectionState, TableSelectionIntents>;
  /** Which allocation the panel shows: the budget's, until another is chosen. */
  allocationMode: () => Machine<AllocationModeState, AllocationModeIntents>;
  /** The coefficients tree of the table the selection holds, as it changes. */
  coefficientsGrid: () => Machine<CoefficientsGridState, TreeGridIntents>;
  /** The allocation in the mode chosen, as it changes. */
  allocationGrid: () => Machine<AllocationGridState, TreeGridIntents>;
  /** The Units grid's rows, from the period's root. */
  unitsGrid: () => Machine<TreeGridState<UnitsRow>, TreeGridIntents>;
  /** The Unit Owners tab's rows, of the unit the Units screen selects. */
  unitOwnersGrid: () => Machine<TreeGridState<OwnersRow>, TreeGridIntents>;
  /**
   * The widths of a grid's columns. A grid keeps widths for each set of
   * columns it is drawn with, told apart by value: one drawn with another
   * count of installments, say, has widths of its own, and finds the first
   * ones again when it is drawn with the first columns.
   */
  columns: (
    grid: GridName,
    spec: readonly ColumnSpec[],
  ) => Machine<ColumnsState, ColumnsIntents>;
  split: (split: SplitName) => Machine<SplitState, SplitIntents>;
  /** A panel's tabs, told apart by value as a grid's columns are. */
  bottomTab: (
    panel: TabbedPanelName,
    tabs: readonly string[],
  ) => Machine<BottomTabState, BottomTabIntents>;
}

/** What the screens' grids show, from the presenters. */
export interface ScreenSources {
  accountsTree$: Observable<AccountNode | null>;
  journalEntries$: Observable<JournalEntryView[]>;
  schedule$: Observable<Schedule | null>;
  tables$: Observable<TableView[]>;
  coefficients$: (tableId: string | null) => Observable<CoefficientNode[]>;
  allocation$: (mode: AllocationMode) => Observable<Allocation | null>;
  units$: Observable<UnitsView | null>;
  /**
   * The selected period, once each time it changes to another. Each emission
   * opens every grid's rows as they start; the one a grid finds when it is
   * built changes nothing, since the grid holds its starting state then.
   */
  period$: Observable<unknown>;
}

export function createScreens(sources: ScreenSources): AppScreens {
  const { period$ } = sources;
  const tableSelection = once(
    (): Machine<TableSelectionState, TableSelectionIntents> => {
      return createTableSelectionMachine(sources.tables$);
    },
  );
  const allocationMode = once(createAllocationModeMachine);

  return {
    accountsGrid: once((): Machine<AccountsGridState, AccountsGridIntents> => {
      return createAccountsGridMachine(sources.accountsTree$, period$);
    }),
    journalGrid: once((): Machine<JournalGridState, JournalGridIntents> => {
      return createJournalGridMachine(sources.journalEntries$, period$);
    }),
    scheduleGrid: once((): Machine<ScheduleGridState, ScheduleGridIntents> => {
      return createScheduleGridMachine(sources.schedule$, period$);
    }),
    tableSelection,
    allocationMode,
    coefficientsGrid: once(
      (): Machine<CoefficientsGridState, TreeGridIntents> => {
        return createCoefficientsGridMachine(
          tableSelection().state$.pipe(
            switchMap(({ tableId }) => {
              return sources.coefficients$(tableId);
            }),
          ),
          period$,
        );
      },
    ),
    allocationGrid: once((): Machine<AllocationGridState, TreeGridIntents> => {
      return createAllocationGridMachine(
        allocationMode().state$.pipe(
          switchMap(({ mode }) => {
            return sources.allocation$(mode);
          }),
        ),
        period$,
      );
    }),
    unitsGrid: once((): Machine<TreeGridState<UnitsRow>, TreeGridIntents> => {
      return createTreeGridMachine(
        sources.units$.pipe(
          map((view) => {
            return view === null ? [] : [view.list.root];
          }),
        ),
        period$,
      );
    }),
    unitOwnersGrid: once(
      (): Machine<TreeGridState<OwnersRow>, TreeGridIntents> => {
        return createTreeGridMachine(
          sources.units$.pipe(
            map((view) => {
              return view === null || view.owners === null ? [] : [view.owners];
            }),
          ),
          period$,
        );
      },
    ),
    columns: keyedByValue(
      (
        _grid: GridName,
        spec: readonly ColumnSpec[],
      ): Machine<ColumnsState, ColumnsIntents> => {
        return createColumnsMachine(spec);
      },
    ),
    split: keyedByValue(
      (_split: SplitName): Machine<SplitState, SplitIntents> => {
        return createSplitMachine();
      },
    ),
    bottomTab: keyedByValue(
      (
        _panel: TabbedPanelName,
        tabs: readonly string[],
      ): Machine<BottomTabState, BottomTabIntents> => {
        return createBottomTabMachine(tabs);
      },
    ),
  };
}

/** What `create` builds on the first call, handed back on every call after. */
function once<TMade>(create: () => TMade): () => TMade {
  const made: TMade[] = [];

  return (): TMade => {
    const [held] = made;

    if (held !== undefined) {
      return held;
    }

    const fresh = create();

    made.push(fresh);

    return fresh;
  };
}

/** What `create` builds for each set of arguments, by value: the same arguments, written anew, find what it built for them. */
function keyedByValue<TArgs extends readonly unknown[], TMade>(
  create: (...args: TArgs) => TMade,
): (...args: TArgs) => TMade {
  const made = new Map<string, TMade>();

  return (...args: TArgs): TMade => {
    const key = JSON.stringify(args);
    const held = made.get(key);

    if (held !== undefined) {
      return held;
    }

    const fresh = create(...args);

    made.set(key, fresh);

    return fresh;
  };
}
