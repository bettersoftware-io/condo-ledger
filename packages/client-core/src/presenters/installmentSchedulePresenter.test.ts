import { state } from "@rx-state/core";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it } from "vitest";

import {
  type Building,
  type ClockPort,
  cents,
  fixedClock,
  type LegacySeed,
  loadLegacySeed,
  type Schedule,
} from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";

import { createAppHarness } from "../testing/appHarness.ts";
import type { Books } from "./booksPresenter.ts";
import { createInstallmentSchedulePresenter } from "./installmentSchedulePresenter.ts";

describe("the installment schedule presenter", () => {
  it("carries p36's root totals, labelled with the building and period", () => {
    const { latest, stop } = createScheduled();
    const root = latest()?.root;

    expect(root?.previousBalance).toBe(-625099);
    expect(root?.budget).toBe(3800000);
    expect(root?.totalInstallments).toBe(3359188);
    expect(root?.paid).toBe(2182598);
    expect(root?.balance).toBe(1176590);
    expect(root?.label).toBe(labelOfPeriod(seedOf(), "p36"));

    stop();
  });

  it("switches with the period", () => {
    const { app, latest, stop } = createScheduled();

    app.presenters.buildings.selectPeriod("p1");

    expect(latest()?.root.previousBalance).toBe(28892);
    expect(latest()?.root.budget).toBe(740000);
    expect(latest()?.root.totalInstallments).toBe(768892);

    stop();
  });

  it("re-emits the schedule with a new amount after setItemAmount", async () => {
    const { app, latest, stop } = createScheduled();
    const item = unpaidItem(latest());
    const before = cellOf(latest(), item);

    expect(
      await app.presenters.schedule.setItemAmount(item, cents(before + 100)),
    ).toEqual({ ok: true });
    expect(cellOf(latest(), item)).toBe(before + 100);

    stop();
  });

  it("refuses to edit the paid item ii789", () => {
    const { app, latest, stop } = createScheduled();

    expect(app.presenters.schedule.cellEditable("ii789")).toEqual({
      ok: false,
      reason: "item-paid",
    });
    expect(app.presenters.schedule.cellEditable(unpaidItem(latest()))).toEqual({
      ok: true,
    });

    stop();
  });

  it("refuses to delete an installment holding a paid item, and renames an unpaid one", async () => {
    const { app, latest, stop } = createScheduled();
    const paid = installmentOf(latest(), "ii789");

    expect(await app.presenters.schedule.deleteInstallment(paid)).toEqual({
      ok: false,
      reason: "installment-paid",
    });
    expect(
      await app.presenters.schedule.updateInstallment(paid, { name: " " }),
    ).toEqual({ ok: false, reason: "blank-name" });

    stop();
  });

  it("renames an installment, seen in the next schedule", async () => {
    const { app, latest, stop } = createScheduled();
    const id = installmentOf(latest(), unpaidItem(latest()));

    expect(
      await app.presenters.schedule.updateInstallment(id, { name: "Renamed" }),
    ).toEqual({ ok: true });
    expect(
      latest()?.installments.find((installment) => {
        return installment.id === id;
      })?.name,
    ).toBe("Renamed");

    stop();
  });

  it("shows Overdue by the application's clock: nothing before the due dates, the balance after", () => {
    const early = createScheduled(fixedClock("2012-12-01T10:00:00Z"));
    const late = createScheduled();

    expect(early.latest()?.root.overdue).toBe(0);
    expect(late.latest()?.root.overdue).toBe(1176590);

    early.stop();
    late.stop();
  });

  it("survives a tree without the selected period, and recovers when it is back", () => {
    const { app, ports, stop } = createScheduled();
    const books = app.presenters.books.books$.getValue();
    const tree = app.presenters.buildings.tree$.getValue();
    const books$ = new BehaviorSubject<Books | null>(books);
    const tree$ = new BehaviorSubject<Building[]>(tree);
    const presenter = createInstallmentSchedulePresenter(
      state(books$, null),
      tree$,
      ports.installments,
      fixedClock("2026-10-14T08:00:00Z"),
    );
    const errors: unknown[] = [];
    const subscription = presenter.schedule$.subscribe({
      error: (error: unknown) => {
        errors.push(error);
      },
    });

    tree$.next([]);

    expect(errors).toEqual([]);
    expect(presenter.schedule$.getValue()).toBeNull();

    tree$.next(tree);

    expect(errors).toEqual([]);
    expect(presenter.schedule$.getValue()?.root.budget).toBe(3800000);

    subscription.unsubscribe();
    stop();
  });

  it("answers a refusal, not an error, for a cell it cannot judge", () => {
    const empty = createAppHarness(createSeedWithoutBuildings());
    const { app, stop } = createScheduled();

    expect(empty.app.presenters.schedule.cellEditable("ii789")).toEqual({
      ok: false,
      reason: "no-books",
    });
    expect(app.presenters.schedule.cellEditable("ii-gone")).toEqual({
      ok: false,
      reason: "unknown-item",
    });

    stop();
  });

  it("holds nothing before a period is chosen with books", () => {
    const { app } = createAppHarness(createSeedWithoutBuildings());
    const subscription = app.presenters.schedule.schedule$.subscribe();

    expect(app.presenters.schedule.schedule$.getValue()).toBeNull();

    subscription.unsubscribe();
  });
});

function createScheduled(clock?: ClockPort): Scheduled {
  const { app, ports } = createAppHarness(seedOf(), clock);
  let current: Schedule | null = null;
  const subscriptions = [
    app.presenters.schedule.schedule$.subscribe((next) => {
      current = next;
    }),
  ];

  app.presenters.buildings.selectPeriod("p36");

  return {
    app,
    ports,
    latest: (): Schedule | null => {
      return current;
    },
    stop: (): void => {
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }
    },
  };
}

interface Scheduled {
  ports: ReturnType<typeof createAppHarness>["ports"];
  app: ReturnType<typeof createAppHarness>["app"];
  latest: () => Schedule | null;
  stop: () => void;
}

function cellOf(schedule: Schedule | null, itemId: string): number {
  const cell = findCell(schedule?.root, itemId);

  if (cell === undefined || cell === null) {
    throw new Error(`missing: the cell of ${itemId}`);
  }

  return cell;
}

function findCell(
  node: Schedule["root"] | undefined,
  itemId: string,
): number | null | undefined {
  if (node === undefined) {
    return undefined;
  }

  for (const cell of node.cells) {
    if (cell.itemId === itemId) {
      return cell.amount;
    }
  }

  for (const child of node.children) {
    const found = findCell(child, itemId);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function installmentOf(schedule: Schedule | null, itemId: string): string {
  const stack = schedule === null ? [] : [schedule.root];

  while (stack.length > 0) {
    const node = stack.pop();

    for (const cell of node?.cells ?? []) {
      if (cell.itemId === itemId) {
        return cell.installmentId;
      }
    }

    stack.push(...(node?.children ?? []));
  }

  throw new Error(`missing: the installment of ${itemId}`);
}

/** An item of the schedule with an amount and nothing paid on it. */
function unpaidItem(schedule: Schedule | null): string {
  const stack = schedule === null ? [] : [schedule.root];

  while (stack.length > 0) {
    const node = stack.pop();

    for (const cell of node?.cells ?? []) {
      if (cell.itemId !== null && cell.paid === 0 && (cell.amount ?? 0) > 0) {
        return cell.itemId;
      }
    }

    stack.push(...(node?.children ?? []));
  }

  throw new Error("missing: an unpaid item");
}

function createSeedWithoutBuildings(): LegacySeed {
  return { ...loadLegacySeed(legacySeedData), buildings: [] };
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
