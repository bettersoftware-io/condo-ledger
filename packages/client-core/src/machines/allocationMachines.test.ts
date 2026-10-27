import { BehaviorSubject } from "rxjs";
import { describe, expect, it } from "vitest";

import { loadLegacySeed, type ThousandthTable } from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";

import type { TableView } from "../presenters/allocationPresenter.ts";
import { createAppHarness } from "../testing/appHarness.ts";
import {
  createTableSelectionMachine,
  type TreeGridRow,
} from "./allocationMachines.ts";

describe("the table selection", () => {
  it("starts on the period's first table, and follows a click", () => {
    const tables$ = new BehaviorSubject([
      createTableView("dt1", "p1"),
      createTableView("dt2", "p1"),
    ]);
    const machine = createTableSelectionMachine(tables$);

    expect(machine.state$.getValue()).toEqual({ tableId: "dt1" });

    machine.intents.select("dt2");

    expect(machine.state$.getValue()).toEqual({ tableId: "dt2" });

    machine.dispose();
  });

  it("restarts on the first table when the period changes, and on coming back", () => {
    const p1 = [createTableView("dt1", "p1"), createTableView("dt2", "p1")];
    const tables$ = new BehaviorSubject(p1);
    const machine = createTableSelectionMachine(tables$);

    machine.intents.select("dt2");
    tables$.next([createTableView("dt14", "p36")]);

    expect(machine.state$.getValue()).toEqual({ tableId: "dt14" });

    tables$.next(p1);

    expect(machine.state$.getValue()).toEqual({ tableId: "dt1" });

    machine.dispose();
  });

  it("keeps the selection while the period's tables change around it, and falls back when it is deleted", () => {
    const tables$ = new BehaviorSubject([
      createTableView("dt1", "p1"),
      createTableView("dt2", "p1"),
    ]);
    const machine = createTableSelectionMachine(tables$);

    machine.intents.select("dt2");
    tables$.next([
      createTableView("dt1", "p1"),
      createTableView("dt2", "p1"),
      createTableView("dt-new-1", "p1"),
    ]);

    expect(machine.state$.getValue()).toEqual({ tableId: "dt2" });

    tables$.next([createTableView("dt1", "p1")]);

    expect(machine.state$.getValue()).toEqual({ tableId: "dt1" });

    machine.dispose();
  });

  it("selects a table the next tables bring, and nothing in a period with no tables", () => {
    const tables$ = new BehaviorSubject([createTableView("dt1", "p1")]);
    const machine = createTableSelectionMachine(tables$);

    machine.intents.select("dt-new-1");

    expect(machine.state$.getValue()).toEqual({ tableId: "dt1" });

    tables$.next([
      createTableView("dt1", "p1"),
      createTableView("dt-new-1", "p1"),
    ]);

    expect(machine.state$.getValue()).toEqual({ tableId: "dt-new-1" });

    tables$.next([]);

    expect(machine.state$.getValue()).toEqual({ tableId: null });

    machine.dispose();
  });

  it("picks dt1 on p1, dt14 on p36, and never shows p1's coefficients after the switch", () => {
    const { app } = createAppHarness();

    app.presenters.buildings.selectPeriod("p1");

    const selection = app.machines.createTableSelection();
    const grid = app.machines.createCoefficientsGrid(selection.state$);

    expect(selection.state$.getValue()).toEqual({ tableId: "dt1" });
    expect(keysOf(grid.state$.getValue().rows)).toContain("unit:u1");

    const seen: string[][] = [];
    const subscription = grid.state$.subscribe((next) => {
      seen.push(keysOf(next.rows));
    });

    seen.length = 0;
    app.presenters.buildings.selectPeriod("p36");

    expect(selection.state$.getValue()).toEqual({ tableId: "dt14" });
    expect(keysOf(grid.state$.getValue().rows)).toContain("unit:u133");
    expect(
      seen.flat().filter((key) => {
        return P1_KEYS.has(key);
      }),
    ).toEqual([]);

    subscription.unsubscribe();
    grid.dispose();
    selection.dispose();
  });
});

describe("the allocation mode", () => {
  it("starts on the budget and switches to the final balance", () => {
    const { app } = createAppHarness();
    const mode = app.machines.createAllocationMode();

    expect(mode.state$.getValue()).toEqual({ mode: "budget" });

    mode.intents.choose("finalBalance");

    expect(mode.state$.getValue()).toEqual({ mode: "finalBalance" });

    mode.dispose();
  });

  it("drives the allocation grid: the root total follows the mode", () => {
    const { app } = createAppHarness();

    app.presenters.buildings.selectPeriod("p1");

    const mode = app.machines.createAllocationMode();
    const grid = app.machines.createAllocationGrid(mode.state$);

    expect(grid.state$.getValue().rows[0]?.node.total).toBe(740000);

    mode.intents.choose("finalBalance");

    expect(grid.state$.getValue().rows[0]?.node.total).toBe(245519);

    grid.dispose();
    mode.dispose();
  });
});

describe("the allocation grid", () => {
  it("starts with every row open, Roundings last", () => {
    const { grid, stop } = createAllocationGrid();
    const { rows, expanded } = grid.state$.getValue();

    expect(rows[0]?.key).toBe("root");
    expect(rows[0]?.depth).toBe(0);
    expect(rows.at(-1)?.node.kind).toBe("roundings");
    expect(expanded).toContain("root");
    expect(expanded).toContain("group:ug1");
    expect(
      rows.some((row) => {
        return row.depth === 3;
      }),
    ).toBe(true);

    stop();
  });

  it("collapses a group and opens it again", () => {
    const { grid, stop } = createAllocationGrid();
    const before = keysOf(grid.state$.getValue().rows);

    grid.intents.toggle("group:ug1");

    const closed = grid.state$.getValue();

    expect(keysOf(closed.rows)).toContain("group:ug1");
    expect(closed.rows.length).toBeLessThan(before.length);
    expect(closed.expanded).not.toContain("group:ug1");
    expect(
      closed.rows.find((row) => {
        return row.key === "group:ug1";
      })?.expanded,
    ).toBe(false);

    grid.intents.toggle("group:ug1");

    expect(keysOf(grid.state$.getValue().rows)).toEqual(before);

    stop();
  });

  it("collapseAll leaves the root, expandAll shows everything again", () => {
    const { grid, stop } = createAllocationGrid();
    const before = keysOf(grid.state$.getValue().rows);

    grid.intents.collapseAll();

    expect(keysOf(grid.state$.getValue().rows)).toEqual(["root"]);

    grid.intents.expandAll();

    expect(keysOf(grid.state$.getValue().rows)).toEqual(before);

    stop();
  });

  it("shows no rows before a period's allocation is there, and keeps its intents harmless", () => {
    const { app } = createAppHarness({
      ...loadLegacySeed(legacySeedData),
      buildings: [],
    });
    const mode = app.machines.createAllocationMode();
    const grid = app.machines.createAllocationGrid(mode.state$);
    const selection = app.machines.createTableSelection();
    const coefficients = app.machines.createCoefficientsGrid(selection.state$);

    grid.intents.collapseAll();
    grid.intents.toggle("root");
    grid.intents.expandAll();
    coefficients.intents.collapseAll();

    expect(grid.state$.getValue()).toEqual({ rows: [], expanded: [] });
    expect(coefficients.state$.getValue()).toEqual({
      rows: [],
      expanded: [],
    });
    expect(selection.state$.getValue()).toEqual({ tableId: null });

    coefficients.dispose();
    selection.dispose();
    grid.dispose();
    mode.dispose();
  });
});

describe("the coefficients grid", () => {
  it("shows the selected table's groups and units, all open, and collapses to the groups", () => {
    const { app } = createAppHarness();

    app.presenters.buildings.selectPeriod("p1");

    const selection = app.machines.createTableSelection();
    const grid = app.machines.createCoefficientsGrid(selection.state$);

    expect(keysOf(grid.state$.getValue().rows).slice(0, 2)).toEqual([
      "group:ug1",
      "unit:u1",
    ]);

    grid.intents.collapseAll();

    expect(keysOf(grid.state$.getValue().rows)).toEqual([
      "group:ug1",
      "group:ug2",
    ]);

    selection.intents.select("dt3");
    grid.intents.expandAll();

    expect(keysOf(grid.state$.getValue().rows)).toEqual([
      "group:ug1",
      "unit:u1",
      "unit:u2",
      "unit:u3",
      "unit:u4",
    ]);

    grid.dispose();
    selection.dispose();
  });
});

/** Every key of p1's coefficient trees: its groups and its units. */
const P1_KEYS = new Set([
  "group:ug1",
  "group:ug2",
  ...["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8"].map((id) => {
    return `unit:${id}`;
  }),
]);

function createAllocationGrid(): AllocationGridUnderTest {
  const { app } = createAppHarness();

  app.presenters.buildings.selectPeriod("p1");

  const mode = app.machines.createAllocationMode();
  const grid = app.machines.createAllocationGrid(mode.state$);

  return {
    grid,
    stop: (): void => {
      grid.dispose();
      mode.dispose();
    },
  };
}

interface AllocationGridUnderTest {
  grid: ReturnType<
    ReturnType<
      typeof createAppHarness
    >["app"]["machines"]["createAllocationGrid"]
  >;
  stop: () => void;
}

function createTableView(id: string, periodId: string): TableView {
  const table: ThousandthTable = {
    id,
    periodId,
    name: id,
    order: 1,
    notes: "",
    restrictionGroupId: null,
  };

  return { table, total: 0, restriction: "" };
}

function keysOf<TNode>(rows: TreeGridRow<TNode>[]): string[] {
  return rows.map((row) => {
    return row.key;
  });
}
