import {
  BehaviorSubject,
  filter,
  firstValueFrom,
  type Observable,
  switchMap,
  take,
} from "rxjs";
import { describe, expect, it } from "vitest";

import {
  cents,
  fixedClock,
  type GroupDraft,
  type OwnersRow,
  type ResidencyDraft,
  type Unit,
  type UnitDraft,
  type UnitGroup,
  type UnitsRow,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { type AppHarness, createAppHarness } from "#/testing/appHarness.ts";

import {
  createUnitsPresenter,
  type UnitsPresenter,
  type UnitsPresenterPorts,
  type UnitsView,
} from "./unitsPresenter.ts";

describe("the units presenter", () => {
  it("heads Saturno 2011 with the period's root, and starts on its first unit, A1", () => {
    const { view, crumb, stop } = createPresented("p1");

    expect(view().list.root.label).toBe(
      "Saturno / 2011 (Piazza del Duomo, 39, 33033 Codroipo)",
    );
    expect(view().list.unitCount).toBe(8);
    expect(view().selected?.key).toBe("unit:u1");
    expect(view().unit?.code).toBe("A1");
    expect(view().owners?.key).toBe("period:u1");
    expect(view().openingPosted).toBe(true);
    expect(view().period).toEqual({ start: "2011-01-01", end: "2011-12-31" });
    expect(view().resident?.id).toBe("r1");
    expect(view().group).toBeNull();
    expect(crumb()).toBe("A1");

    stop();
  });

  it("selects any row: a group shows no unit and names its code, the root and the rounding name nothing", () => {
    const { units, view, crumb, stop } = createPresented("p1");

    units.select("group:ug2");
    expect(view().selected?.key).toBe("group:ug2");
    expect(view().group).toMatchObject({ id: "ug2", code: "B" });
    expect(view().resident).toBeNull();
    expect(view().unit).toBeNull();
    expect(view().owners).toBeNull();
    expect(crumb()).toBe("B");

    units.select("root");
    expect(view().selected?.key).toBe("root");
    expect(crumb()).toBeNull();

    units.select("rounding");
    expect(view().selected?.key).toBe("rounding");
    expect(view().unit).toBeNull();
    expect(crumb()).toBeNull();

    stop();
  });

  it("places the selected unit by its groups' names, root to leaf; blank at the top and with no unit", async () => {
    const { units, view, stop } = createPresented("p1");

    expect(view().location).toBe("Stairwell A");

    const groupId = addedId(
      await units.addGroup("ug1", createGroupDraft("C", "Lift")),
    );
    const unitId = addedId(await units.addUnit(groupId, createUnitDraft("C1")));

    units.select(`unit:${unitId}`);
    expect(view().location).toBe("Stairwell A » Lift");

    units.select("group:ug2");
    expect(view().location).toBe("");

    stop();

    const pozzetto = createPresented("p36");

    expect(pozzetto.view().unit?.code).toBe("A01");
    expect(pozzetto.view().location).toBe("");

    pozzetto.stop();
  });

  it("names the unit of a selected resident: r166 is A04, its owners A04's", () => {
    const { units, view, crumb, stop } = createPresented("p36");

    units.select("resident:r166");

    expect(view().selected?.residentId).toBe("r166");
    expect(view().resident?.id).toBe("r166");
    expect(view().group).toBeNull();
    expect(view().unit?.id).toBe("u137");
    expect(view().owners?.key).toBe("period:u137");
    expect(crumb()).toBe("A04");

    stop();
  });

  it("starts p36 on A01 after B3 was selected in p1, and never shows a unit of p1 under p36", () => {
    const { harness, units, view, crumb, stop } = createPresented("p1");
    const seen: (UnitsView | null)[] = [];

    units.select("unit:u7");
    expect(view().unit?.code).toBe("B3");

    const subscription = units.view$.subscribe((next) => {
      seen.push(next);
    });

    seen.length = 0;
    harness.app.presenters.buildings.selectPeriod("p36");
    subscription.unsubscribe();

    expect(view().selected?.key).toBe("unit:u133");
    expect(view().unit?.code).toBe("A01");
    expect(view().owners?.key).toBe("period:u133");
    expect(crumb()).toBe("A01");
    expect(
      seen.map((next) => {
        return next?.unit?.periodId ?? null;
      }),
    ).not.toContain("p1");

    harness.app.presenters.buildings.selectPeriod("p1");
    expect(view().unit?.code).toBe("A1");

    stop();
  });

  it("is null while the units of p36 are on their way, then shows p36's", () => {
    const harness = createAppHarness();
    const answered$ = new BehaviorSubject(false);
    const units = createUnitsPresenter(
      harness.app.presenters.books.books$,
      harness.app.presenters.buildings.tree$,
      createLatePorts(harness, "p36", answered$),
      fixedClock("2026-10-30T08:00:00Z"),
    );
    const seen: (string | null)[] = [];
    const subscription = units.view$.subscribe((next) => {
      seen.push(next?.unit?.periodId ?? null);
    });

    harness.app.presenters.buildings.selectPeriod("p1");
    seen.length = 0;
    harness.app.presenters.buildings.selectPeriod("p36");
    expect(units.view$.getValue()).toBeNull();

    answered$.next(true);
    expect(units.view$.getValue()?.unit?.code).toBe("A01");
    expect(seen).not.toContain("p1");

    subscription.unsubscribe();
  });

  it("lists a group added under A, and edits and deletes it", async () => {
    const { units, view, stop } = createPresented("p1");
    const added = await units.addGroup("ug1", createGroupDraft("C", "Lift"));
    const id = addedId(added);

    expect(id).toBe("ug-new-1");
    expect(
      childKeys(rowOf(view(), "group:ug1")).filter((key) => {
        return key.startsWith("group:");
      }),
    ).toEqual(["group:ug-new-1"]);
    expect(rowOf(view(), `group:${id}`).label).toBe("C - Lift");

    expect(
      await units.editGroup(id, createGroupDraft("C", "Lift shaft")),
    ).toEqual({ ok: true });
    expect(rowOf(view(), `group:${id}`).label).toBe("C - Lift shaft");

    units.select(`group:${id}`);
    expect(await units.deleteGroup(id)).toEqual({ ok: true });
    expect(findRow(view().list.root, `group:${id}`)).toBeUndefined();
    // The deleted row's selection falls back on the first unit.
    expect(view().selected?.key).toBe("unit:u1");

    stop();
  });

  it("halves A3's owner's Budget when a second owner moves in without a percentage, A3's total unchanged", async () => {
    const { units, view, stop } = createPresented("p1");
    const before = rowOf(view(), "unit:u3");

    expect(before.residentId).toBe("r4");

    const id = addedId(
      await units.addResident("u3", createResidencyDraft("md6")),
    );
    const after = rowOf(view(), "unit:u3");

    expect(
      after.children.map((row) => {
        return [row.residentId, row.budget, row.actual];
      }),
    ).toEqual([
      ["r4", 108716, 36828],
      [id, 108716, 36828],
    ]);
    expect(after.budget).toBe(before.budget);
    expect(after.actual).toBe(before.actual);

    stop();
  });

  it("answers a refused delete with its reason and keeps the row selected", async () => {
    const { units, view, stop } = createPresented("p36");

    units.select("resident:r166");

    expect(await units.deleteResident("r166")).toMatchObject({
      ok: false,
      reason: "named-in-journal",
    });
    expect(view().selected?.key).toBe("resident:r166");

    expect(await units.deleteUnit("u137")).toMatchObject({
      ok: false,
      reason: "named-in-journal",
    });
    expect(view().selected?.key).toBe("resident:r166");

    stop();
  });

  it("gives unit A19, once its resident has a coefficient, a Budget; edits and deletes them", async () => {
    const { harness, units, view, stop } = createPresented("p36");
    const unitId = addedId(await units.addUnit(null, createUnitDraft("A19")));
    const residentId = addedId(
      await units.addResident(unitId, createResidencyDraft("md104")),
    );

    expect(rowOf(view(), `unit:${unitId}`).residentId).toBe(residentId);
    expect(rowOf(view(), `unit:${unitId}`).budget).toBe(0);

    for (const table of await firstValueFrom(
      harness.ports.tables.tables("p36"),
    )) {
      expect(
        await harness.ports.tables.setCoefficient(table.id, unitId, 500000),
      ).toEqual({ ok: true });
    }

    expect(rowOf(view(), `unit:${unitId}`).budget).toBeGreaterThan(0);
    // The root still equals the cost budgets' total: A19's share came out of the others'.
    expect(view().list.root.budget).toBe(3800000);

    expect(
      await units.editUnit(unitId, { ...createUnitDraft("A20"), floor: "3" }),
    ).toEqual({ ok: true });
    expect(rowOf(view(), `unit:${unitId}`).floor).toBe("3");
    expect(
      await units.editResident(residentId, {
        ...createResidencyDraft("md104"),
        role: "CO",
      }),
    ).toEqual({ ok: true });
    expect(rowOf(view(), `unit:${unitId}`).label).toMatch(/\(CO\)$/u);

    units.select(`unit:${unitId}`);
    expect(await units.deleteResident(residentId)).toEqual({ ok: true });
    expect(await units.deleteUnit(unitId)).toEqual({ ok: true });
    expect(findRow(view().list.root, `unit:${unitId}`)).toBeUndefined();
    expect(view().selected?.key).toBe("unit:u133");

    stop();
  });

  it("keeps r165 selected when the other resident of A03 leaves and their row folds into A03's", async () => {
    const { units, view, crumb, stop } = createPresented("p36");
    const added = addedId(
      await units.addResident("u136", createResidencyDraft("md104")),
    );

    units.select("resident:r165");
    expect(view().selected?.key).toBe("resident:r165");

    expect(await units.deleteResident(added)).toEqual({ ok: true });
    expect(view().selected).toMatchObject({
      key: "unit:u136",
      residentId: "r165",
    });
    expect(view().unit?.code).toBe("A03");
    expect(crumb()).toBe("A03");

    stop();
  });

  it("selects A04 when its selected resident is deleted", async () => {
    const { units, view, crumb, stop } = createPresented("p36");
    const added = addedId(
      await units.addResident("u137", createResidencyDraft("md104")),
    );

    units.select(`resident:${added}`);
    expect(await units.deleteResident(added)).toEqual({ ok: true });

    expect(view().selected?.key).toBe("unit:u137");
    expect(crumb()).toBe("A04");

    stop();
  });

  it("selects the group of a selected unit that is deleted", async () => {
    const { units, view, crumb, stop } = createPresented("p1");
    const unitId = addedId(await units.addUnit("ug2", createUnitDraft("B5")));

    units.select(`unit:${unitId}`);
    expect(await units.deleteUnit(unitId)).toEqual({ ok: true });

    expect(view().selected?.key).toBe("group:ug2");
    expect(crumb()).toBe("B");

    stop();
  });

  it("names a unit by one code in every emission while its code changes", async () => {
    const { units, view, stop } = createPresented("p1");
    const seen: UnitsView[] = [];

    units.select("unit:u5");

    const subscription = units.view$.subscribe((next) => {
      if (next !== null) {
        seen.push(next);
      }
    });

    seen.length = 0;
    expect(await units.editUnit("u5", createUnitDraft("B9"))).toEqual({
      ok: true,
    });
    subscription.unsubscribe();

    expect(seen.length).toBeGreaterThan(0);

    for (const next of seen) {
      const code = must(next.unit, "B1's unit").code;

      expect(
        must(next.selected, "B1's row").label.startsWith(`${code} - `),
      ).toBe(true);
      expect(residentKeysOf(must(next.owners, "B1's owners"))).toEqual(
        childKeys(must(next.selected, "B1's row")),
      );
    }

    expect(view().unit?.code).toBe("B9");

    stop();
  });

  it("lists the contacts an owner can be linked to", () => {
    const { units, stop } = createPresented("p1");
    const subscription = units.contacts$.subscribe();

    expect(units.contacts$.getValue()).toHaveLength(48);

    subscription.unsubscribe();
    stop();
  });

  it("holds nothing with no period, and adds nothing", () => {
    const harness = createAppHarness({
      ...createAppHarness().seed,
      buildings: [],
    });
    const { units } = harness.app.presenters;
    const subscription = units.view$.subscribe();

    expect(units.view$.getValue()).toBeNull();
    expect(units.snapshot()).toBeNull();
    expect(() => {
      return units.addUnit(null, createUnitDraft("A19"));
    }).toThrow("missing: the period of the new unit");
    expect(() => {
      return units.addGroup(null, createGroupDraft("C", "Lift"));
    }).toThrow("missing: the period of the new group");

    subscription.unsubscribe();
  });
});

/** The app on the real seed with its units presenter subscribed, on a period. */
interface Presented {
  harness: AppHarness;
  units: UnitsPresenter;
  view: () => UnitsView;
  crumb: () => string | null;
  stop: () => void;
}

function createPresented(periodId: string): Presented {
  const harness = createAppHarness();
  const { units } = harness.app.presenters;
  const subscriptions = [units.view$.subscribe(), units.crumb$.subscribe()];

  harness.app.presenters.buildings.selectPeriod(periodId);

  return {
    harness,
    units,
    view: (): UnitsView => {
      return must(units.view$.getValue(), "the units view");
    },
    crumb: (): string | null => {
      return units.crumb$.getValue();
    },
    stop: (): void => {
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }
    },
  };
}

/** The harness's ports, with the units and tables of one period held until `answered$` says true. */
function createLatePorts(
  harness: AppHarness,
  latePeriodId: string,
  answered$: Observable<boolean>,
): UnitsPresenterPorts {
  const { ports } = harness;

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
    tables: ports.tables,
    contacts: ports.contacts,
    units: {
      ...ports.units,
      units: (periodId: string): Observable<Unit[]> => {
        return late(periodId, ports.units.units(periodId));
      },
      groups: (periodId: string): Observable<UnitGroup[]> => {
        return late(periodId, ports.units.groups(periodId));
      },
    },
  };
}

function rowOf(view: UnitsView, key: string): UnitsRow {
  return must(findRow(view.list.root, key), `the row ${key}`);
}

function findRow(row: UnitsRow, key: string): UnitsRow | undefined {
  if (row.key === key) {
    return row;
  }

  for (const child of row.children) {
    const found = findRow(child, key);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function childKeys(row: UnitsRow): string[] {
  return row.children.map((child) => {
    return child.key;
  });
}

/** The resident rows of a unit's owners, keyed as the Units grid keys them. */
function residentKeysOf(owners: OwnersRow): string[] {
  return owners.children.flatMap((role) => {
    return role.children.map((resident) => {
      return `resident:${must(resident.residentId, "a resident's id")}`;
    });
  });
}

function addedId(
  result: Awaited<ReturnType<UnitsPresenter["addUnit"]>>,
): string {
  if (!result.ok) {
    throw new Error(`refused: ${result.reason}`);
  }

  return result.value.id;
}

function createGroupDraft(code: string, name: string): GroupDraft {
  return { code, name, address: null, notes: null };
}

function createUnitDraft(code: string): UnitDraft {
  return {
    code,
    name: null,
    floor: null,
    interior: null,
    subUnit: null,
    restriction: null,
    type: "apartment",
    cadastralData: null,
    notes: null,
  };
}

function createResidencyDraft(contactId: string): ResidencyDraft {
  return {
    contactId,
    role: "PR",
    startingBalance: cents(0),
    ownRestriction: null,
  };
}
