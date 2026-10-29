import { type DefaultedStateObservable, state } from "@rx-state/core";
import {
  BehaviorSubject,
  combineLatest,
  map,
  NEVER,
  type Observable,
} from "rxjs";

import { type AccountNode, ROOT_KEY } from "@cl/domain";

import type { Machine } from "./machine.ts";

interface GridRow {
  key: string;
  node: AccountNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

export interface AccountsGridState {
  rows: GridRow[];
  expanded: string[];
  search: string;
  hideEmpty: boolean;
}

export interface AccountsGridIntents {
  toggle: (key: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setSearch: (text: string) => void;
  setHideEmpty: (hide: boolean) => void;
}

export const INITIAL_EXPANDED: readonly string[] = [
  ROOT_KEY,
  "patrimonial",
  "assets",
  "liabilities",
  "costs",
  "revenue",
];

interface Preferences {
  expanded: ReadonlySet<string>;
  search: string;
  hideEmpty: boolean;
}

/**
 * What the Accounts grid shows of the presenter's tree: which nodes are open,
 * the search and the hide-empty filter. The tree is the presenter's and
 * shared. Each emission of `restart$` opens the nodes as they start again,
 * and keeps the search and the filter.
 */
export function createAccountsGridMachine(
  tree$: Observable<AccountNode | null>,
  restart$: Observable<unknown> = NEVER,
): Machine<AccountsGridState, AccountsGridIntents> {
  const preferences$ = new BehaviorSubject<Preferences>({
    expanded: new Set(INITIAL_EXPANDED),
    search: "",
    hideEmpty: false,
  });
  const latestTree = new BehaviorSubject<AccountNode | null>(null);
  const state$: DefaultedStateObservable<AccountsGridState> = state(
    combineLatest([tree$, preferences$]).pipe(
      map(([tree, preferences]) => {
        latestTree.next(tree);

        return {
          rows:
            tree === null
              ? []
              : visibleRows(
                  tree,
                  preferences.expanded,
                  preferences.search,
                  preferences.hideEmpty,
                ),
          expanded: [...preferences.expanded],
          search: preferences.search,
          hideEmpty: preferences.hideEmpty,
        };
      }),
    ),
    { rows: [], expanded: [...INITIAL_EXPANDED], search: "", hideEmpty: false },
  );
  const subscription = state$.subscribe();
  const restarts = restart$.subscribe(() => {
    update({ expanded: new Set(INITIAL_EXPANDED) });
  });

  function update(change: Partial<Preferences>): void {
    preferences$.next({ ...preferences$.getValue(), ...change });
  }

  return {
    state$,
    intents: {
      toggle: (key: string): void => {
        const expanded = new Set(preferences$.getValue().expanded);

        if (!expanded.delete(key)) {
          expanded.add(key);
        }

        update({ expanded });
      },
      expandAll: (): void => {
        const tree = latestTree.getValue();
        update({
          expanded: new Set(tree === null ? INITIAL_EXPANDED : allKeys(tree)),
        });
      },
      collapseAll: (): void => {
        update({ expanded: new Set() });
      },
      setSearch: (text: string): void => {
        update({ search: text });
      },
      setHideEmpty: (hide: boolean): void => {
        update({ hideEmpty: hide });
      },
    },
    dispose: (): void => {
      restarts.unsubscribe();
      subscription.unsubscribe();
      preferences$.complete();
    },
  };
}

/** The rows to draw, in order: the open nodes' children, after the filters. A search keeps a match and its ancestors, shown open. */
export function visibleRows(
  tree: AccountNode,
  expanded: ReadonlySet<string>,
  search: string,
  hideEmpty: boolean,
): GridRow[] {
  const needle = search.trim().toLocaleLowerCase("it");
  const kept = prune(tree, needle, hideEmpty);

  if (kept === null) {
    return [];
  }

  const rows: GridRow[] = [];

  function walk(node: AccountNode, depth: number): void {
    const hasChildren = node.children.length > 0;
    const open = needle !== "" || expanded.has(node.key);

    rows.push({
      key: node.key,
      node,
      depth,
      hasChildren,
      expanded: hasChildren && open,
    });

    if (hasChildren && open) {
      for (const child of node.children) {
        walk(child, depth + 1);
      }
    }
  }

  walk(kept, 0);

  return rows;
}

/**
 * The subtree with the filtered-out nodes removed; null when the node itself
 * goes. A node with anything surviving under it stays whatever its own label,
 * so a match keeps its ancestors; a leaf stays only if it matches and, under
 * hide-empty, has amounts or a budget (Total always stays that far).
 */
function prune(
  node: AccountNode,
  needle: string,
  hideEmpty: boolean,
): AccountNode | null {
  const children = node.children
    .map((child) => {
      return prune(child, needle, hideEmpty);
    })
    .filter((child) => {
      return child !== null;
    });

  const matches =
    needle === "" || node.label.toLocaleLowerCase("it").includes(needle);

  const empty =
    hideEmpty &&
    node.debit === 0 &&
    node.credit === 0 &&
    (node.budget === null || node.budget === 0);

  if (children.length === 0 && (!matches || (empty && node.key !== ROOT_KEY))) {
    return null;
  }

  return { ...node, children };
}

function allKeys(node: AccountNode): string[] {
  return [node.key, ...node.children.flatMap(allKeys)];
}
