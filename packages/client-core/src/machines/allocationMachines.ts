import { type DefaultedStateObservable, state } from "@rx-state/core";
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  map,
  merge,
  NEVER,
  type Observable,
  Subject,
  scan,
} from "rxjs";

import type {
  Allocation,
  AllocationMode,
  AllocationRow,
  CoefficientNode,
} from "@cl/domain";

import type { TableView } from "../presenters/allocationPresenter.ts";
import type { Machine } from "./machine.ts";
import { createReducerMachine } from "./reducerMachine.ts";

export interface TableSelectionState {
  tableId: string | null;
}

export interface TableSelectionIntents {
  select: (tableId: string) => void;
}

export interface AllocationModeState {
  mode: AllocationMode;
}

export interface AllocationModeIntents {
  choose: (mode: AllocationMode) => void;
}

/** A node of a tree the grids show: a key, and the nodes under it. */
interface TreeNode<TNode> {
  key: string;
  children: TNode[];
}

export interface TreeGridRow<TNode> {
  key: string;
  node: TNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

export interface TreeGridState<TNode> {
  /** The visible nodes, in order, each with its depth. */
  rows: TreeGridRow<TNode>[];
  /** The keys of the open nodes. */
  expanded: string[];
}

export interface TreeGridIntents {
  toggle: (key: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
}

export type CoefficientsGridState = TreeGridState<CoefficientNode>;

export type AllocationGridState = TreeGridState<AllocationRow>;

/**
 * Which of the period's tables is selected. It starts on the first, and a
 * selection lasts only while the tables hold it: another period's tables, or
 * the selected one deleted, start again on the first.
 */
export function createTableSelectionMachine(
  tables$: Observable<TableView[]>,
): Machine<TableSelectionState, TableSelectionIntents> {
  const selected$ = new Subject<string>();
  const state$: DefaultedStateObservable<TableSelectionState> = state(
    merge(
      tables$.pipe(
        map((tables): SelectionAction => {
          return { kind: "tables", ids: idsOf(tables) };
        }),
      ),
      selected$.pipe(
        map((tableId): SelectionAction => {
          return { kind: "select", tableId };
        }),
      ),
    ).pipe(
      scan(reduceSelection, { ids: [], chosen: null }),
      map(selectedOf),
      distinctUntilChanged(),
      map((tableId) => {
        return { tableId };
      }),
    ),
    { tableId: null },
  );
  const subscription = state$.subscribe();

  return {
    state$,
    intents: {
      select: (tableId: string): void => {
        selected$.next(tableId);
      },
    },
    dispose: (): void => {
      subscription.unsubscribe();
      selected$.complete();
    },
  };
}

/** Which allocation the panel shows. It starts on the budget. */
export function createAllocationModeMachine(): Machine<
  AllocationModeState,
  AllocationModeIntents
> {
  return createReducerMachine<
    AllocationModeState,
    AllocationMode,
    AllocationModeIntents
  >(
    { mode: "budget" },
    (_state, mode) => {
      return { mode };
    },
    (dispatch) => {
      return { choose: dispatch };
    },
  );
}

/** Which nodes of the selected table's coefficients are open. Everything starts open, and again on each emission of `restart$`. */
export function createCoefficientsGridMachine(
  nodes$: Observable<CoefficientNode[]>,
  restart$: Observable<unknown> = NEVER,
): Machine<CoefficientsGridState, TreeGridIntents> {
  return createTreeGridMachine(nodes$, restart$);
}

/** Which rows of the allocation are open, from its root. Everything starts open, and again on each emission of `restart$`. */
export function createAllocationGridMachine(
  allocation$: Observable<Allocation | null>,
  restart$: Observable<unknown> = NEVER,
): Machine<AllocationGridState, TreeGridIntents> {
  return createTreeGridMachine(
    allocation$.pipe(
      map((allocation) => {
        return allocation === null ? [] : [allocation.root];
      }),
    ),
    restart$,
  );
}

type SelectionAction =
  | { kind: "tables"; ids: string[] }
  | { kind: "select"; tableId: string };

interface Selection {
  /** The ids of the period's tables, in order. */
  ids: string[];
  /** The table clicked, while the tables hold it, or about to. */
  chosen: string | null;
}

function reduceSelection(
  selection: Selection,
  action: SelectionAction,
): Selection {
  switch (action.kind) {
    case "tables":
      return {
        ids: action.ids,
        chosen:
          selection.chosen !== null && action.ids.includes(selection.chosen)
            ? selection.chosen
            : null,
      };
    case "select":
      return { ...selection, chosen: action.tableId };
  }
}

function selectedOf(selection: Selection): string | null {
  return selection.chosen !== null && selection.ids.includes(selection.chosen)
    ? selection.chosen
    : (selection.ids[0] ?? null);
}

function idsOf(tables: TableView[]): string[] {
  return tables.map((view) => {
    return view.table.id;
  });
}

/**
 * Which nodes of a tree are open. Everything starts open, a node new to a
 * later tree too: the machine keeps what was closed, until `restart$` opens
 * everything again.
 */
export function createTreeGridMachine<TNode extends TreeNode<TNode>>(
  roots$: Observable<TNode[]>,
  restart$: Observable<unknown>,
): Machine<TreeGridState<TNode>, TreeGridIntents> {
  const closed$ = new BehaviorSubject<ReadonlySet<string>>(new Set());
  const latestRoots = new BehaviorSubject<TNode[]>([]);
  const state$: DefaultedStateObservable<TreeGridState<TNode>> = state(
    combineLatest([roots$, closed$]).pipe(
      map(([roots, closed]) => {
        latestRoots.next(roots);

        return gridOf(roots, closed);
      }),
    ),
    { rows: [], expanded: [] },
  );
  const subscription = state$.subscribe();
  const restarts = restart$.subscribe(() => {
    closed$.next(new Set());
  });

  return {
    state$,
    intents: {
      toggle: (key: string): void => {
        const closed = new Set(closed$.getValue());

        if (!closed.delete(key)) {
          closed.add(key);
        }

        closed$.next(closed);
      },
      expandAll: (): void => {
        closed$.next(new Set());
      },
      collapseAll: (): void => {
        closed$.next(new Set(latestRoots.getValue().flatMap(allKeys)));
      },
    },
    dispose: (): void => {
      restarts.unsubscribe();
      subscription.unsubscribe();
      closed$.complete();
      latestRoots.complete();
    },
  };
}

function gridOf<TNode extends TreeNode<TNode>>(
  roots: TNode[],
  closed: ReadonlySet<string>,
): TreeGridState<TNode> {
  const rows: TreeGridRow<TNode>[] = [];

  function walk(node: TNode, depth: number): void {
    const hasChildren = node.children.length > 0;
    const open = hasChildren && !closed.has(node.key);

    rows.push({ key: node.key, node, depth, hasChildren, expanded: open });

    if (open) {
      for (const child of node.children) {
        walk(child, depth + 1);
      }
    }
  }

  for (const root of roots) {
    walk(root, 0);
  }

  return {
    rows,
    expanded: roots.flatMap(allKeys).filter((key) => {
      return !closed.has(key);
    }),
  };
}

function allKeys<TNode extends TreeNode<TNode>>(node: TNode): string[] {
  return [node.key, ...node.children.flatMap(allKeys)];
}
