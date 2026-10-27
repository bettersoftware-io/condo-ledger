import { afterEach, describe, expect, it } from "vitest";

import {
  ok,
  type Result,
  type TableDraft,
  type ThousandthTable,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { type AppHarness, createAppHarness } from "#/testing/appHarness.ts";

import type { Machine } from "./machine.ts";
import {
  createTableDialog,
  type TableDialogIntents,
  type TableDialogState,
} from "./tableDialogMachine.ts";

afterEach(() => {
  for (const machine of created.splice(0)) {
    machine.dispose();
  }
});

describe("the thousandth table dialog", () => {
  it("a new table on p1 opens blank, on order 6 after the five tables, refused blank-name and untouched", () => {
    const harness = createAppHarness();
    const machine = track(harness.app.machines.createTableDialog(null));

    expect(machine.state$.getValue()).toEqual({
      form: { name: "", order: "6", notes: "" },
      verdict: { ok: false, reason: "blank-name" },
      touched: false,
      saving: false,
      editing: null,
    });
  });

  it("a new table in a period with no tables defaults to order 1", () => {
    const machine = track(createTableDialog([], null, acceptWrite));

    expect(machine.state$.getValue().form.order).toBe("1");
  });

  it("the default order follows the highest order, not the count", () => {
    const machine = track(
      createTableDialog(
        [createTable("dt1", "A", 3), createTable("dt2", "B", 9)],
        null,
        acceptWrite,
      ),
    );

    expect(machine.state$.getValue().form.order).toBe("10");
  });

  it.each([
    [{ name: "  " }, "blank-name"],
    [{ name: "Test", order: "0" }, "bad-order"],
    [{ name: "Test", order: "x" }, "bad-order"],
    [{ name: "Test", order: "" }, "bad-order"],
    [{ name: "Test", order: "1.5" }, "bad-order"],
    [{ name: "Test", order: "-2" }, "bad-order"],
    [{ name: "Test" }, null],
    [{ name: "Test", order: " 1 " }, null],
  ])("answers %j with %s", (patch, reason) => {
    const machine = track(createTableDialog(TABLES, null, acceptWrite));

    machine.intents.edit(patch);

    const { verdict, touched } = machine.state$.getValue();

    expect(verdict.ok ? null : verdict.reason).toBe(reason);
    expect(touched).toBe(true);
  });

  it("refuses a name another table of the period has, name-taken", () => {
    const harness = createAppHarness();
    const machine = track(harness.app.machines.createTableDialog(null));

    machine.intents.edit({ name: tableName(harness, "dt2") });

    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "name-taken",
    });
  });

  it("Save calls the write with the name, the order as it reads, and the notes", async () => {
    const written: TableDraft[] = [];
    const machine = track(
      createTableDialog(TABLES, null, (draft) => {
        written.push(draft);

        return Promise.resolve(ok());
      }),
    );

    machine.intents.edit({ name: "Test", order: " 7 ", notes: "Lift" });

    await expect(machine.intents.save()).resolves.toEqual({ ok: true });
    expect(written).toEqual([{ name: "Test", order: 7, notes: "Lift" }]);
  });

  it("Save writes nothing while the form is refused, and nothing twice while a save runs", async () => {
    let writes = 0;
    const resolvers: ((result: Result) => void)[] = [];
    const machine = track(
      createTableDialog(TABLES, null, () => {
        writes += 1;

        return new Promise<Result>((resolve) => {
          resolvers.push(resolve);
        });
      }),
    );

    await expect(machine.intents.save()).resolves.toEqual({
      ok: false,
      reason: "blank-name",
    });
    expect(writes).toBe(0);

    machine.intents.edit({ name: "Test" });

    const first = machine.intents.save();

    expect(machine.state$.getValue().saving).toBe(true);
    await expect(machine.intents.save()).resolves.toEqual({
      ok: false,
      reason: "saving",
    });
    expect(writes).toBe(1);

    must(resolvers[0], "the first write")(ok());
    await expect(first).resolves.toEqual({ ok: true });
    expect(machine.state$.getValue().saving).toBe(false);
  });

  it("through the app, a new table is added to the selected period", async () => {
    const harness = createAppHarness();
    const machine = track(harness.app.machines.createTableDialog(null));

    machine.intents.edit({ name: "Test" });

    await expect(machine.intents.save()).resolves.toEqual({
      ok: true,
      value: { id: "dt-new-1" },
    });
    expect(tableOf(harness, "dt-new-1")).toMatchObject({
      name: "Test",
      order: 6,
      notes: "",
    });
  });

  it("an edit opens on the table, keeps its own name, and saves through the edit", async () => {
    const harness = createAppHarness();
    const table = tableOf(harness, "dt2");
    const machine = track(harness.app.machines.createTableDialog("dt2"));

    expect(machine.state$.getValue()).toEqual({
      form: {
        name: table.name,
        order: String(table.order),
        notes: table.notes,
      },
      verdict: { ok: true },
      touched: false,
      saving: false,
      editing: "dt2",
    });

    machine.intents.edit({ name: tableName(harness, "dt1") });
    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "name-taken",
    });

    machine.intents.edit({ name: "Renamed", order: "1", notes: "n" });
    await expect(machine.intents.save()).resolves.toEqual({ ok: true });
    expect(tableOf(harness, "dt2")).toMatchObject({
      name: "Renamed",
      order: 1,
      notes: "n",
    });
  });

  it("an edit of a table the selected period does not hold is not built", () => {
    const harness = createAppHarness();

    expect(() => {
      return harness.app.machines.createTableDialog("dt-none");
    }).toThrow("dt-none");
  });
});

const TABLES: ThousandthTable[] = [
  createTable("dt1", "Property", 1),
  createTable("dt2", "Lift", 2),
];

const created: Machine<TableDialogState, TableDialogIntents>[] = [];

function track(
  machine: Machine<TableDialogState, TableDialogIntents>,
): Machine<TableDialogState, TableDialogIntents> {
  created.push(machine);

  return machine;
}

function acceptWrite(): Promise<Result> {
  return Promise.resolve(ok());
}

/** A table of the selected period as the allocation presenter holds it now. */
function tableOf(harness: AppHarness, id: string): ThousandthTable {
  const { tables$ } = harness.app.presenters.allocation;
  const subscription = tables$.subscribe();
  const view = tables$.getValue().find((candidate) => {
    return candidate.table.id === id;
  });

  subscription.unsubscribe();

  return must(view, `the table ${id}`).table;
}

function tableName(harness: AppHarness, id: string): string {
  return tableOf(harness, id).name;
}

function createTable(id: string, name: string, order: number): ThousandthTable {
  return {
    id,
    periodId: "p1",
    name,
    order,
    notes: "",
    restrictionGroupId: null,
  };
}
