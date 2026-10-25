import { type DefaultedStateObservable, state } from "@rx-state/core";
import { BehaviorSubject, combineLatest, map, type Observable } from "rxjs";

import type { Schedule, ScheduleNode } from "@cl/domain";

import type { Machine } from "./machine.ts";

export interface ScheduleGridRow {
  key: string;
  node: ScheduleNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

export interface ScheduleGridState {
  /** The visible nodes, in order, each with its depth. */
  rows: ScheduleGridRow[];
  /** The keys of the open nodes. */
  expanded: string[];
}

export interface ScheduleGridIntents {
  toggle: (key: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
}

/**
 * Which nodes of the presenter's schedule are open. Everything starts open,
 * a node new to a later schedule too: the machine keeps what was closed.
 */
export function createScheduleGridMachine(
  schedule$: Observable<Schedule | null>,
): Machine<ScheduleGridState, ScheduleGridIntents> {
  const closed$ = new BehaviorSubject<ReadonlySet<string>>(new Set());
  const latestRoot = new BehaviorSubject<ScheduleNode | null>(null);
  const state$: DefaultedStateObservable<ScheduleGridState> = state(
    combineLatest([schedule$, closed$]).pipe(
      map(([schedule, closed]) => {
        latestRoot.next(schedule?.root ?? null);

        return schedule === null
          ? { rows: [], expanded: [] }
          : stateOf(schedule.root, closed);
      }),
    ),
    { rows: [], expanded: [] },
  );
  const subscription = state$.subscribe();

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
        const root = latestRoot.getValue();

        closed$.next(new Set(root === null ? [] : allKeys(root)));
      },
    },
    dispose: (): void => {
      subscription.unsubscribe();
      closed$.complete();
      latestRoot.complete();
    },
  };
}

function stateOf(
  root: ScheduleNode,
  closed: ReadonlySet<string>,
): ScheduleGridState {
  const rows: ScheduleGridRow[] = [];

  function walk(node: ScheduleNode, depth: number): void {
    const hasChildren = node.children.length > 0;
    const open = hasChildren && !closed.has(node.key);

    rows.push({ key: node.key, node, depth, hasChildren, expanded: open });

    if (open) {
      for (const child of node.children) {
        walk(child, depth + 1);
      }
    }
  }

  walk(root, 0);

  return {
    rows,
    expanded: allKeys(root).filter((key) => {
      return !closed.has(key);
    }),
  };
}

function allKeys(node: ScheduleNode): string[] {
  return [node.key, ...node.children.flatMap(allKeys)];
}
