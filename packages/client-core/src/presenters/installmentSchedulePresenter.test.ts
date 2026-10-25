import { describe, expect, it } from "vitest";

import {
  cents,
  type LegacySeed,
  loadLegacySeed,
  type Schedule,
} from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";

import { createAppHarness } from "../testing/appHarness.ts";

describe("the installment schedule presenter", () => {
  it("carries p36's root totals, labelled with the building and period", () => {
    const { latest, stop } = createScheduled();
    const root = latest()?.root;

    expect(root?.previousBalance).toBe(-625099);
    expect(root?.budget).toBe(3800000);
    expect(root?.totalInstallments).toBe(3359188);
    expect(root?.paid).toBe(2182598);
    expect(root?.balance).toBe(1176590);
    expect(root?.label).toMatch(/\S+ \S+/);

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

  it("cannot judge a cell before a period's books are there", () => {
    const { app } = createAppHarness(createSeedWithoutBuildings());

    expect(() => {
      return app.presenters.schedule.cellEditable("ii789");
    }).toThrow("missing: the selected period's books");
  });

  it("holds nothing before a period is chosen with books", () => {
    const { app } = createAppHarness(createSeedWithoutBuildings());

    expect(app.presenters.schedule.schedule$.getValue()).toBeNull();
  });
});

function createScheduled(): Scheduled {
  const { app } = createAppHarness();
  let current: Schedule | null = null;
  const subscriptions = [
    app.presenters.schedule.schedule$.subscribe((next) => {
      current = next;
    }),
  ];

  app.presenters.buildings.selectPeriod("p36");

  return {
    app,
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
