import { describe, expect, it } from "vitest";

import { loadLegacySeed } from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";

import { type AppHarness, createAppHarness } from "../testing/appHarness.ts";
import type { ScheduleGridRow } from "./scheduleGridMachine.ts";

describe("the schedule grid machine", () => {
  it("starts with every row open: the root, the units and the residents", () => {
    const { machine, stop } = createGrid();
    const { rows, expanded } = machine.state$.getValue();

    expect(rows[0]?.key).toBe("root");
    expect(rows[0]?.depth).toBe(0);
    expect(keysOf(rows)).toContain("unit:A04");
    expect(
      rows.some((row) => {
        return row.depth === 2;
      }),
    ).toBe(true);
    expect(expanded).toContain("unit:A04");

    stop();
  });

  it("collapses A04 and shows it again", () => {
    const { machine, stop } = createGrid();
    const before = keysOf(machine.state$.getValue().rows);
    const children = childKeysOf(machine.state$.getValue().rows, "unit:A04");

    expect(children.length).toBeGreaterThan(0);

    machine.intents.toggle("unit:A04");

    const closed = machine.state$.getValue();

    expect(keysOf(closed.rows)).toContain("unit:A04");
    expect(keysOf(closed.rows)).not.toContain(children[0]);
    expect(closed.expanded).not.toContain("unit:A04");

    machine.intents.toggle("unit:A04");

    expect(keysOf(machine.state$.getValue().rows)).toEqual(before);

    stop();
  });

  it("a period switch opens the rows a person closed: back on p36, A04 is open again", () => {
    const { machine, stop, app } = createGrid();

    machine.intents.toggle("unit:A04");

    expect(machine.state$.getValue().expanded).not.toContain("unit:A04");

    app.presenters.buildings.selectPeriod("p1");
    app.presenters.buildings.selectPeriod("p36");

    expect(machine.state$.getValue().expanded).toContain("unit:A04");

    stop();
  });

  it("shows no rows before a period's schedule is there, and keeps its intents harmless", () => {
    const { app } = createAppHarness({
      ...loadLegacySeed(legacySeedData),
      buildings: [],
    });
    const machine = app.screens.scheduleGrid();

    machine.intents.collapseAll();
    machine.intents.toggle("root");
    machine.intents.expandAll();

    expect(machine.state$.getValue()).toEqual({ rows: [], expanded: [] });

    machine.dispose();
  });

  it("collapseAll leaves the root, expandAll shows everything again", () => {
    const { machine, stop } = createGrid();
    const before = keysOf(machine.state$.getValue().rows);

    machine.intents.collapseAll();

    expect(keysOf(machine.state$.getValue().rows)).toEqual(["root"]);

    machine.intents.expandAll();

    expect(keysOf(machine.state$.getValue().rows)).toEqual(before);

    stop();
  });
});

function createGrid(): Grid {
  const { app } = createAppHarness();
  const subscription = app.presenters.schedule.schedule$.subscribe();

  app.presenters.buildings.selectPeriod("p36");

  const machine = app.screens.scheduleGrid();

  return {
    app,
    machine,
    stop: (): void => {
      machine.dispose();
      subscription.unsubscribe();
    },
  };
}

interface Grid {
  app: AppHarness["app"];
  machine: ReturnType<
    ReturnType<typeof createAppHarness>["app"]["screens"]["scheduleGrid"]
  >;
  stop: () => void;
}

function keysOf(rows: ScheduleGridRow[]): string[] {
  return rows.map((row) => {
    return row.key;
  });
}

function childKeysOf(rows: ScheduleGridRow[], key: string): string[] {
  return (
    rows
      .find((row) => {
        return row.key === key;
      })
      ?.node.children.map((child) => {
        return child.key;
      }) ?? []
  );
}
