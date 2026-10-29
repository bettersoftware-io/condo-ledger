import { describe, expect, it } from "vitest";

import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";

import { type ColumnSpec, columnSpecsFrom } from "./machines/columnsMachine.ts";
import type { JournalGridRow } from "./machines/journalGridMachine.ts";
import { createAppHarness } from "./testing/appHarness.ts";

describe("the screens' state", () => {
  it("hands every asker the same machine for a grid, its columns, a split and a tabbed panel", () => {
    const { screens } = createAppHarness(createSmallSeed()).app;

    expect(screens.accountsGrid()).toBe(screens.accountsGrid());
    expect(screens.journalGrid()).toBe(screens.journalGrid());
    expect(screens.scheduleGrid()).toBe(screens.scheduleGrid());
    expect(screens.tableSelection()).toBe(screens.tableSelection());
    expect(screens.allocationMode()).toBe(screens.allocationMode());
    expect(screens.coefficientsGrid()).toBe(screens.coefficientsGrid());
    expect(screens.allocationGrid()).toBe(screens.allocationGrid());
    expect(screens.columns("accounts", SPEC)).toBe(
      screens.columns("accounts", createSpec(3)),
    );
    expect(screens.split("accounts")).toBe(screens.split("accounts"));
    expect(screens.bottomTab("accounts", TABS)).toBe(
      screens.bottomTab("accounts", [...TABS]),
    );
  });

  it("keeps each grid's widths, each split and each panel's tab apart", () => {
    const { screens } = createAppHarness(createSmallSeed()).app;

    screens.columns("accounts", SPEC).intents.resize(1, 150);
    screens.split("allocationRows").intents.setRatio(0.3);
    screens.bottomTab("accounts", TABS).intents.activate("Ledger");

    expect(screens.columns("accounts", SPEC).state$.getValue().widths).toEqual([
      null,
      150,
      null,
    ]);
    expect(screens.columns("ledger", SPEC).state$.getValue().widths).toEqual([
      null,
      null,
      null,
    ]);
    expect(screens.split("allocationRows").state$.getValue().ratio).toBe(0.3);
    expect(screens.split("allocationColumns").state$.getValue().ratio).toBe(
      0.5,
    );
    expect(screens.split("accounts").state$.getValue().ratio).toBe(0.5);
    expect(screens.bottomTab("accounts", TABS).state$.getValue().active).toBe(
      "Ledger",
    );
  });

  it("keeps a grid's widths for each set of columns it is drawn with", () => {
    const { screens } = createAppHarness(createSmallSeed()).app;

    screens.columns("schedule", createSpec(4)).intents.resize(1, 150);

    expect(
      screens.columns("schedule", createSpec(6)).state$.getValue().widths,
    ).toEqual([null, null, null, null, null, null]);
    expect(
      screens.columns("schedule", createSpec(4)).state$.getValue().widths,
    ).toEqual([null, 150, null, null]);
  });

  // p36's coefficients are flat, with nothing to close: the coefficients
  // grid's reset is held in allocationMachines.test.ts, on p1.
  it("a period switch opens each grid's rows as they start, and keeps the widths, the splits, the tab and the filters", () => {
    const { app } = createAppHarness();
    const { screens } = app;

    app.presenters.buildings.selectPeriod("p36");

    const accounts = screens.accountsGrid();
    const journal = screens.journalGrid();
    const schedule = screens.scheduleGrid();
    const allocation = screens.allocationGrid();
    const opening = accounts.state$.getValue().expanded;
    const firstEntry = firstEntryOf(journal.state$.getValue().rows);

    accounts.intents.toggle("costs");
    accounts.intents.setHideEmpty(true);
    journal.intents.toggle(firstEntry);
    journal.intents.select(firstEntry);
    journal.intents.setPageSize(25);
    journal.intents.setPage(2);
    schedule.intents.collapseAll();
    allocation.intents.collapseAll();
    screens.columns("accounts", SPEC).intents.resize(1, 150);
    screens.split("accounts").intents.setRatio(0.3);
    screens.bottomTab("accounts", TABS).intents.activate("Ledger");

    expect(accounts.state$.getValue().expanded).not.toContain("costs");
    expect(journal.state$.getValue().page).toBe(2);
    expect(allOpen(schedule.state$.getValue().rows)).toBe(false);
    expect(allOpen(allocation.state$.getValue().rows)).toBe(false);

    // Away and back: the rows are p36's again, so what was closed would show.
    app.presenters.buildings.selectPeriod("p1");
    app.presenters.buildings.selectPeriod("p36");

    expect(accounts.state$.getValue()).toMatchObject({
      expanded: opening,
      hideEmpty: true,
    });
    expect(journal.state$.getValue()).toMatchObject({
      expanded: [],
      selectedId: null,
      page: 1,
      pageSize: 25,
    });
    expect(allOpen(schedule.state$.getValue().rows)).toBe(true);
    expect(allOpen(allocation.state$.getValue().rows)).toBe(true);
    expect(screens.columns("accounts", SPEC).state$.getValue().widths).toEqual([
      null,
      150,
      null,
    ]);
    expect(screens.split("accounts").state$.getValue().ratio).toBe(0.3);
    expect(screens.bottomTab("accounts", TABS).state$.getValue().active).toBe(
      "Ledger",
    );
  });

  it("choosing the period already chosen starts nothing again, nor does the period a grid is first asked for on", () => {
    const { app } = createAppHarness();

    app.presenters.buildings.selectPeriod("p36");

    const accounts = app.screens.accountsGrid();

    accounts.intents.toggle("costs");
    app.presenters.buildings.selectPeriod("p36");

    expect(accounts.state$.getValue().expanded).not.toContain("costs");
  });
});

const TABS = ["Account Details", "Ledger"] as const;

const SPEC: readonly ColumnSpec[] = createSpec(3);

/** A grid's columns: the first flexible, then `count - 1` of 100px. */
function createSpec(count: number): ColumnSpec[] {
  return columnSpecsFrom(
    Array.from({ length: count }, () => {
      return 100;
    }),
    0,
    200,
    400,
  );
}

interface OpenableRow {
  hasChildren: boolean;
  expanded: boolean;
}

/** Whether there are rows, and every one with children is open. */
function allOpen(rows: readonly OpenableRow[]): boolean {
  return (
    rows.length > 0 &&
    rows.every((row) => {
      return !row.hasChildren || row.expanded;
    })
  );
}

function firstEntryOf(rows: readonly JournalGridRow[]): string {
  const [first] = rows;

  if (first?.kind !== "entry") {
    throw new Error("missing: the journal's first entry");
  }

  return first.entry.id;
}
