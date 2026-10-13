import { BehaviorSubject } from "rxjs";
import { describe, expect, it } from "vitest";

import { type AccountNode, buildAccountTree, cents } from "@cl/domain";
import { createSmallBooks } from "@cl/domain/testing/createSmallBooks.ts";

import {
  type AccountsGridIntents,
  type AccountsGridState,
  createAccountsGridMachine,
  INITIAL_EXPANDED,
  visibleRows,
} from "./accountsGridMachine.ts";
import type { Machine } from "./machine.ts";

describe("the accounts grid machine", () => {
  it("shows Total and the five levels open, and the levels' children closed, at the start", () => {
    const { machine } = createGrid();
    const { rows } = machine.state$.getValue();

    expect(keysOf(rows).slice(0, 5)).toEqual([
      "total",
      "patrimonial",
      "assets",
      "la10",
      "la4@assets",
    ]);
    expect(rowOf(rows, "la10")?.expanded).toBe(false);

    machine.dispose();
  });

  it("toggle opens and closes a node", () => {
    const { machine } = createGrid();

    machine.intents.toggle("la10");

    expect(keysOf(machine.state$.getValue().rows)).toEqual(
      expect.arrayContaining(["la1", "la2"]),
    );

    machine.intents.toggle("la10");

    expect(keysOf(machine.state$.getValue().rows)).not.toContain("la1");
    expect(keysOf(machine.state$.getValue().rows)).not.toContain("la2");

    machine.dispose();
  });

  it("expandAll shows every node, collapseAll only Total", () => {
    const { machine, tree } = createGrid();

    machine.intents.expandAll();

    expect(machine.state$.getValue().rows).toHaveLength(countOf(tree));

    machine.intents.collapseAll();

    expect(
      machine.state$.getValue().rows.map((row) => {
        return { key: row.key, expanded: row.expanded };
      }),
    ).toEqual([{ key: "total", expanded: false }]);

    machine.dispose();
  });

  it("a search keeps the matches with their ancestors, open", () => {
    const { machine } = createGrid();

    machine.intents.setSearch("cassa");

    expect(keysOf(machine.state$.getValue().rows)).toEqual([
      "total",
      "patrimonial",
      "assets",
      "la10",
      "la1",
    ]);

    machine.intents.setSearch("");

    expect(rowOf(machine.state$.getValue().rows, "la10")?.expanded).toBe(false);
    expect(keysOf(machine.state$.getValue().rows)).not.toContain("la1");

    machine.dispose();
  });

  it("a search that matches nothing shows no rows", () => {
    const { machine } = createGrid();
    const before = keysOf(machine.state$.getValue().rows);

    machine.intents.setSearch("zzz");

    expect(machine.state$.getValue().rows).toEqual([]);

    machine.intents.setSearch("");

    expect(keysOf(machine.state$.getValue().rows)).toEqual(before);

    machine.dispose();
  });

  it("hide-empty drops a node with no amounts and no budget", () => {
    const { machine } = createGrid();

    machine.intents.expandAll();

    expect(keysOf(machine.state$.getValue().rows)).toContain("la3");

    machine.intents.setHideEmpty(true);
    machine.intents.expandAll();

    expect(keysOf(machine.state$.getValue().rows)).not.toContain("la3");
    expect(keysOf(machine.state$.getValue().rows)).toContain("la30");

    machine.intents.setHideEmpty(false);

    expect(keysOf(machine.state$.getValue().rows)).toContain("la3");

    machine.dispose();
  });

  it("hide-empty keeps a node with a budget though nothing is posted to it", () => {
    const tree = patched(createTree(), (node) => {
      return node.key === "la3" ? { ...node, budget: cents(1000) } : node;
    });

    expect(
      keysOf(visibleRows(tree, new Set(keysUnder(tree)), "", true)),
    ).toContain("la3");
  });

  it("hide-empty keeps Total when everything under it is empty", () => {
    const tree = patched(createTree(), (node) => {
      return { ...node, debit: cents(0), credit: cents(0), budget: null };
    });

    expect(keysOf(visibleRows(tree, new Set(["total"]), "", true))).toEqual([
      "total",
    ]);
  });

  it("a search is matched without its surrounding spaces", () => {
    const tree = createTree();

    expect(keysOf(visibleRows(tree, new Set(), "  cassa  ", false))).toEqual(
      keysOf(visibleRows(tree, new Set(), "cassa", false)),
    );
    expect(keysOf(visibleRows(tree, new Set(), "  cassa  ", false))).toContain(
      "la1",
    );
  });

  it("shows nothing until the tree arrives, then the rows", () => {
    const tree$ = new BehaviorSubject<AccountNode | null>(null);
    const machine = createAccountsGridMachine(tree$);

    expect(machine.state$.getValue().rows).toEqual([]);

    tree$.next(createTree());

    expect(machine.state$.getValue().rows.length).toBeGreaterThan(0);

    machine.dispose();
  });

  it("expandAll before the tree arrives keeps the initial expansion", () => {
    const machine = createAccountsGridMachine(
      new BehaviorSubject<AccountNode | null>(null),
    );

    machine.intents.expandAll();

    expect(machine.state$.getValue().expanded).toContain("total");

    machine.dispose();
  });

  it("visibleRows opens exactly the expanded set when nothing filters", () => {
    const tree = createTree();

    expect(
      keysOf(visibleRows(tree, new Set(INITIAL_EXPANDED), "", false)).slice(
        0,
        5,
      ),
    ).toEqual(["total", "patrimonial", "assets", "la10", "la4@assets"]);
    expect(visibleRows(tree, new Set(), "", false)).toHaveLength(1);
  });

  it("dispose ends the state", () => {
    const { machine } = createGrid();
    const seen: string[] = [];

    machine.state$.subscribe((current) => {
      return seen.push(current.search);
    });
    machine.intents.setSearch("cassa");
    machine.dispose();
    machine.intents.setSearch("banca");

    expect(seen).toEqual(["", "cassa"]);
  });
});

function createTree(): AccountNode {
  const books = createSmallBooks();

  return buildAccountTree(books.accounts, books.entries, books.parties);
}

function createGrid(): GridFixture {
  const tree = createTree();

  return {
    machine: createAccountsGridMachine(
      new BehaviorSubject<AccountNode | null>(tree),
    ),
    tree,
  };
}

function keysOf(rows: AccountsGridState["rows"]): string[] {
  return rows.map((row) => {
    return row.key;
  });
}

function rowOf(
  rows: AccountsGridState["rows"],
  key: string,
): AccountsGridState["rows"][number] | undefined {
  return rows.find((row) => {
    return row.key === key;
  });
}

function countOf(node: AccountNode): number {
  return (
    1 +
    node.children.reduce((sum, child) => {
      return sum + countOf(child);
    }, 0)
  );
}

interface GridFixture {
  machine: Machine<AccountsGridState, AccountsGridIntents>;
  tree: AccountNode;
}

function patched(
  node: AccountNode,
  change: (node: AccountNode) => AccountNode,
): AccountNode {
  const children = node.children.map((child) => {
    return patched(child, change);
  });

  return change({ ...node, children });
}

function keysUnder(node: AccountNode): string[] {
  return [node.key, ...node.children.flatMap(keysUnder)];
}
