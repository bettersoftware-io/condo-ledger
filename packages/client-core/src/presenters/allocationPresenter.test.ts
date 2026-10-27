import { state } from "@rx-state/core";
import {
  BehaviorSubject,
  filter,
  type Observable,
  switchMap,
  take,
} from "rxjs";
import { describe, expect, it } from "vitest";

import {
  type Allocation,
  type AllocationRow,
  type Building,
  type Coefficient,
  type CoefficientNode,
  type LegacySeed,
  loadLegacySeed,
  type ThousandthTable,
  type Unit,
  type UnitGroup,
} from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";

import type { AmountLocale } from "../amounts.ts";
import { createTableSelectionMachine } from "../machines/allocationMachines.ts";
import { createAppHarness } from "../testing/appHarness.ts";
import {
  type AllocationPresenterPorts,
  createAllocationPresenter,
  type TableView,
} from "./allocationPresenter.ts";
import type { Books } from "./booksPresenter.ts";

describe("the allocation presenter", () => {
  it("lists p1's five tables in order, with their totals and restrictions", () => {
    const { tables, stop } = createAllocated();

    expect(
      tables().map((view) => {
        return view.table.id;
      }),
    ).toEqual(["dt1", "dt2", "dt3", "dt4", "dt5"]);
    expect(tableOf(tables(), "dt1").total).toBe(10000000);
    expect(tableOf(tables(), "dt1").restriction).toBe("");
    expect(tableOf(tables(), "dt3").restriction).toBe("Scala A");

    stop();
  });

  it("allocates p1's budget and final balance, labelled with the building and period", () => {
    const { app, allocation, stop } = createAllocated();
    const finalBalance = app.presenters.allocation.allocation$("finalBalance");
    const subscription = finalBalance.subscribe();

    expect(allocation()?.root.label).toBe(labelOfPeriod(seedOf(), "p1"));
    expect(allocation()?.root.total).toBe(740000);
    expect(finalBalance.getValue()?.root.total).toBe(245519);

    subscription.unsubscribe();
    stop();
  });

  it("builds one stream per mode and per table", () => {
    const { app } = createAppHarness();
    const { allocation } = app.presenters;

    expect(allocation.allocation$("budget")).toBe(
      allocation.allocation$("budget"),
    );
    expect(allocation.allocation$("budget")).not.toBe(
      allocation.allocation$("finalBalance"),
    );
    expect(allocation.coefficients$("dt1")).toBe(
      allocation.coefficients$("dt1"),
    );
    expect(allocation.coefficients$(null)).toBe(allocation.coefficients$(null));
  });

  it("re-emits the table total, the coefficient and A1's share after a saved coefficient", async () => {
    const { app, tables, allocation, coefficients, stop } = createAllocated();
    const before = rowOf(allocation(), "A1");

    expect(
      await app.presenters.allocation.setCoefficient("dt1", "u1", "200"),
    ).toEqual({ ok: true });

    const after = rowOf(allocation(), "A1");

    expect(tableOf(tables(), "dt1").total).toBe(11000000);
    expect(nodeOf(coefficients(), "unit:u1").value).toBe(2000000);
    // The first column, la28, is the one Property allocates: 2,800.00 × 200 ÷ 1,100.
    expect(changedColumns(before, after)).toEqual([0]);
    expect(before.amounts[0]).toBe(28000);
    expect(after.amounts[0]).toBe(50909);
    expect(after.total).toBe(before.total + 50909 - 28000);

    stop();
  });

  it("reads the coefficient in the session's locale", async () => {
    const { app, coefficients, stop } = createAllocated();

    expect(await app.presenters.session.setLanguage("it")).toEqual({
      ok: true,
    });

    expect(
      await app.presenters.allocation.setCoefficient("dt1", "u1", "0,022"),
    ).toEqual({ ok: true });
    expect(nodeOf(coefficients(), "unit:u1").value).toBe(220);

    stop();
  });

  it.each(["-1", "abc", "1.23456"])(
    "refuses %s as not-a-coefficient, and nothing re-emits",
    async (text) => {
      const { app, emissions, stop } = createAllocated();
      const before = emissions();

      expect(
        await app.presenters.allocation.setCoefficient("dt1", "u1", text),
      ).toEqual({ ok: false, reason: "not-a-coefficient" });
      expect(emissions()).toEqual(before);

      stop();
    },
  );

  it("shows a table's coefficients as groups and units, and its restriction alone", () => {
    const { app, coefficients, stop } = createAllocated();
    const restricted = app.presenters.allocation.coefficients$("dt3");
    const subscription = restricted.subscribe();

    expect(
      coefficients().map((node) => {
        return node.key;
      }),
    ).toEqual(["group:ug1", "group:ug2"]);
    expect(nodeOf(coefficients(), "group:ug1").value).toBe(9200000);
    expect(
      restricted.getValue().map((node) => {
        return node.key;
      }),
    ).toEqual(["group:ug1"]);

    subscription.unsubscribe();
    stop();
  });

  it("shows no coefficients for no table, nor for a table of another period", () => {
    const { app, stop } = createAllocated();
    const none = app.presenters.allocation.coefficients$(null);
    const elsewhere = app.presenters.allocation.coefficients$("dt14");
    const subscriptions = [none.subscribe(), elsewhere.subscribe()];

    expect(none.getValue()).toEqual([]);
    expect(elsewhere.getValue()).toEqual([]);

    for (const subscription of subscriptions) {
      subscription.unsubscribe();
    }

    stop();
  });

  it("adds a table to the selected period, edits it, and deletes it", async () => {
    const { app, tables, stop } = createAllocated();
    const { allocation } = app.presenters;
    const added = await allocation.addTable({
      name: "Test",
      order: 6,
      notes: "",
    });

    expect(added).toEqual({ ok: true, value: { id: "dt-new-1" } });
    expect(tableOf(tables(), "dt-new-1").total).toBe(0);
    expect(
      await allocation.editTable("dt-new-1", {
        name: "Test 2",
        order: 1,
        notes: "",
      }),
    ).toEqual({ ok: true });
    expect(tables()[0]?.table.name).toBe("Test 2");
    expect(await allocation.deleteTable("dt-new-1")).toEqual({ ok: true });
    expect(tables()).toHaveLength(5);

    stop();
  });

  it("refuses to delete a table an account allocates through", async () => {
    const { app, tables, stop } = createAllocated();

    expect(await app.presenters.allocation.deleteTable("dt1")).toMatchObject({
      ok: false,
      reason: "table-linked",
    });
    expect(tables()).toHaveLength(5);

    stop();
  });

  it("follows the period: p36 lists its own tables and never mixes in p1's", () => {
    const { app, tables, allocation, stop } = createAllocated();
    const seen: string[][] = [];
    const subscription = app.presenters.allocation.tables$.subscribe(
      (views) => {
        seen.push(
          views.map((view) => {
            return view.table.periodId;
          }),
        );
      },
    );

    seen.length = 0;
    app.presenters.buildings.selectPeriod("p36");

    expect(tables()[0]?.table.id).toBe("dt14");
    expect(allocation()?.root.label).toBe(labelOfPeriod(seedOf(), "p36"));
    expect(
      seen.flat().every((periodId) => {
        return periodId === "p36";
      }),
    ).toBe(true);

    subscription.unsubscribe();
    stop();
  });

  it("holds nothing before a period is chosen with books", () => {
    const { app } = createAppHarness({ ...seedOf(), buildings: [] });
    const { allocation } = app.presenters;
    const subscriptions = [
      allocation.tables$.subscribe(),
      allocation.allocation$("budget").subscribe(),
      allocation.coefficients$("dt1").subscribe(),
    ];

    expect(allocation.tables$.getValue()).toEqual([]);
    expect(allocation.allocation$("budget").getValue()).toBeNull();
    expect(allocation.coefficients$("dt1").getValue()).toEqual([]);

    for (const subscription of subscriptions) {
      subscription.unsubscribe();
    }
  });

  it("refuses to add a table with no period", () => {
    const { app } = createAppHarness({ ...seedOf(), buildings: [] });

    expect(() => {
      return app.presenters.allocation.addTable({
        name: "Test",
        order: 1,
        notes: "",
      });
    }).toThrow("missing: the period of the new table");
  });

  it("survives a tree without the selected period, and recovers when it is back", () => {
    const { app, ports } = createAppHarness();
    const subscription = app.presenters.books.books$.subscribe();

    app.presenters.buildings.selectPeriod("p1");

    const books$ = new BehaviorSubject<Books | null>(
      app.presenters.books.books$.getValue(),
    );
    const tree = app.presenters.buildings.tree$.getValue();
    const tree$ = new BehaviorSubject<Building[]>(tree);
    const presenter = createAllocationPresenter(
      state(books$, null),
      tree$,
      { tables: ports.tables, units: ports.units },
      createLocale("en-US"),
    );
    const budget = presenter.allocation$("budget");
    const held = budget.subscribe();

    tree$.next([]);

    expect(budget.getValue()).toBeNull();

    tree$.next(tree);

    expect(budget.getValue()?.root.total).toBe(740000);

    held.unsubscribe();
    subscription.unsubscribe();
  });

  it("holds nothing of p1 while p36's tables and units are on their way, then shows p36's", () => {
    const { app, ports } = createAppHarness();
    const answered$ = new BehaviorSubject(false);
    const presenter = createAllocationPresenter(
      app.presenters.books.books$,
      app.presenters.buildings.tree$,
      createLatePorts(ports, "p36", answered$),
      createLocale("en-US"),
    );
    const selection = createTableSelectionMachine(presenter.tables$);
    const nodes: CoefficientNode[][] = [];
    const subscriptions = [
      presenter.allocation$("budget").subscribe(),
      selection.state$
        .pipe(
          switchMap(({ tableId }) => {
            return presenter.coefficients$(tableId);
          }),
        )
        .subscribe((next) => {
          nodes.push(next);
        }),
    ];

    app.presenters.buildings.selectPeriod("p1");

    expect(selection.state$.getValue()).toEqual({ tableId: "dt1" });

    nodes.length = 0;
    app.presenters.buildings.selectPeriod("p36");

    expect(presenter.tables$.getValue()).toEqual([]);
    expect(presenter.allocation$("budget").getValue()).toBeNull();
    expect(selection.state$.getValue()).toEqual({ tableId: null });
    expect(nodes.flat()).toEqual([]);

    answered$.next(true);

    expect(presenter.tables$.getValue()[0]?.table.id).toBe("dt14");
    expect(selection.state$.getValue()).toEqual({ tableId: "dt14" });
    expect(presenter.allocation$("budget").getValue()?.root.label).toBe(
      labelOfPeriod(seedOf(), "p36"),
    );
    expect(nodes.at(-1)?.[0]?.key).toBe("unit:u133");

    for (const subscription of subscriptions) {
      subscription.unsubscribe();
    }

    selection.dispose();
  });
});

/** The tables and units ports, with the period's reads held until `answered$` says true: a port that answers late. */
function createLatePorts(
  ports: ReturnType<typeof createAppHarness>["ports"],
  latePeriodId: string,
  answered$: Observable<boolean>,
): AllocationPresenterPorts {
  function late<T>(periodId: string, read: Observable<T>): Observable<T> {
    return periodId === latePeriodId
      ? answered$.pipe(
          filter(Boolean),
          take(1),
          switchMap(() => {
            return read;
          }),
        )
      : read;
  }

  return {
    tables: {
      ...ports.tables,
      tables: (periodId: string): Observable<ThousandthTable[]> => {
        return late(periodId, ports.tables.tables(periodId));
      },
      coefficients: (periodId: string): Observable<Coefficient[]> => {
        return late(periodId, ports.tables.coefficients(periodId));
      },
    },
    units: {
      units: (periodId: string): Observable<Unit[]> => {
        return late(periodId, ports.units.units(periodId));
      },
      groups: (periodId: string): Observable<UnitGroup[]> => {
        return late(periodId, ports.units.groups(periodId));
      },
    },
  };
}

function createAllocated(): Allocated {
  const { app, ports } = createAppHarness();
  const { allocation } = app.presenters;
  const counts = { tables: 0, allocation: 0, coefficients: 0 };
  const subscriptions = [
    allocation.tables$.subscribe(() => {
      counts.tables += 1;
    }),
    allocation.allocation$("budget").subscribe(() => {
      counts.allocation += 1;
    }),
    allocation.coefficients$("dt1").subscribe(() => {
      counts.coefficients += 1;
    }),
  ];

  app.presenters.buildings.selectPeriod("p1");

  return {
    app,
    ports,
    tables: (): TableView[] => {
      return allocation.tables$.getValue();
    },
    allocation: (): Allocation | null => {
      return allocation.allocation$("budget").getValue();
    },
    coefficients: (): CoefficientNode[] => {
      return allocation.coefficients$("dt1").getValue();
    },
    emissions: (): Counts => {
      return { ...counts };
    },
    stop: (): void => {
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }
    },
  };
}

interface Counts {
  tables: number;
  allocation: number;
  coefficients: number;
}

interface Allocated {
  app: ReturnType<typeof createAppHarness>["app"];
  ports: ReturnType<typeof createAppHarness>["ports"];
  tables: () => TableView[];
  allocation: () => Allocation | null;
  coefficients: () => CoefficientNode[];
  emissions: () => Counts;
  stop: () => void;
}

function createLocale(locale: AmountLocale): BehaviorSubject<AmountLocale> {
  return new BehaviorSubject<AmountLocale>(locale);
}

function tableOf(views: TableView[], id: string): TableView {
  const view = views.find((candidate) => {
    return candidate.table.id === id;
  });

  if (view === undefined) {
    throw new Error(`missing: the table ${id}`);
  }

  return view;
}

function nodeOf(nodes: CoefficientNode[], key: string): CoefficientNode {
  const stack = [...nodes];

  while (stack.length > 0) {
    const node = stack.pop();

    if (node?.key === key) {
      return node;
    }

    stack.push(...(node?.children ?? []));
  }

  throw new Error(`missing: the coefficient node ${key}`);
}

/** The first row, depth first, whose label starts with the unit's code. */
function rowOf(allocation: Allocation | null, code: string): AllocationRow {
  const stack = allocation === null ? [] : [allocation.root];

  while (stack.length > 0) {
    const row = stack.shift();

    if (row?.label.startsWith(`${code} `) === true) {
      return row;
    }

    stack.push(...(row?.children ?? []));
  }

  throw new Error(`missing: the row of ${code}`);
}

function changedColumns(before: AllocationRow, after: AllocationRow): number[] {
  return before.amounts.flatMap((amount, index) => {
    return after.amounts[index] === amount ? [] : [index];
  });
}

function seedOf(): LegacySeed {
  return loadLegacySeed(legacySeedData);
}

function labelOfPeriod(seed: LegacySeed, periodId: string): string {
  for (const building of seed.buildings) {
    for (const period of building.periods) {
      if (period.id === periodId) {
        return `${building.name} ${period.name}`;
      }
    }
  }

  throw new Error(`missing: the period ${periodId}`);
}
