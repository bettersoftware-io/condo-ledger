import { describe, expect, it } from "vitest";

import {
  type BuildingRow,
  cents,
  type OwnerParty,
  type PeriodDraft,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { type AppHarness, createAppHarness } from "#/testing/appHarness.ts";

import type {
  BuildingDataPresenter,
  BuildingDataView,
} from "./buildingDataPresenter.ts";

describe("the building data presenter", () => {
  it("lists Pozzetto and Saturno by name, each over its period", () => {
    const { view, stop } = createPresented();

    expect(
      view().rows.map((row) => {
        return [row.key, row.label, childKeys(row)];
      }),
    ).toEqual([
      ["c19", "Pozzetto (Piazza Libertà, 74, 33045 Nimis)", ["p36"]],
      ["c1", "Saturno (Piazza del Duomo, 39, 33033 Codroipo)", ["p1"]],
    ]);

    stop();
  });

  it("gives both period rows the spec's Liquidity, Funds, Budget, Actual, Prev. bal. and Total due", () => {
    const { view, stop } = createPresented();

    expect(rowOf(view(), "p1").figures).toEqual({
      liquidity: cents(295_414),
      funds: cents(175_000),
      budget: cents(740_000),
      actual: cents(245_519),
      previousBalance: cents(28_892),
      due: cents(274_411),
    });
    expect(rowOf(view(), "p36").figures).toEqual({
      liquidity: cents(107_826),
      funds: cents(0),
      budget: cents(3_800_000),
      actual: cents(3_488_771),
      previousBalance: cents(-625_099),
      due: cents(2_863_672),
    });

    stop();
  });

  it("starts on the app's period row with its building, and follows the sidebar", () => {
    const { harness, view, stop } = createPresented();

    expect(view().selected?.key).toBe("p1");
    expect(view().building?.name).toBe("Saturno");

    harness.app.presenters.buildings.selectPeriod("p36");

    expect(view().selected?.key).toBe("p36");
    expect(view().building?.name).toBe("Pozzetto");

    stop();
  });

  it("makes p1 the app's period when Saturno's period row is selected", () => {
    const { harness, buildingData, view, stop } = createPresented();
    const { buildings } = harness.app.presenters;

    buildings.selectPeriod("p36");
    buildingData.select("p1");

    expect(view().selected?.key).toBe("p1");
    expect(buildings.selected$.getValue()?.periodId).toBe("p1");

    stop();
  });

  it("shows a selected building's profile without changing the period, until the sidebar moves", () => {
    const { harness, buildingData, view, stop } = createPresented();
    const { buildings } = harness.app.presenters;

    buildings.selectPeriod("p36");
    buildingData.select("c1");

    expect(view().selected?.key).toBe("c1");
    expect(view().building).toMatchObject({ code: "SAT", name: "Saturno" });
    expect(buildings.selected$.getValue()?.periodId).toBe("p36");

    // Choosing the same period again leaves the building selected.
    buildings.selectPeriod("p36");
    expect(view().selected?.key).toBe("c1");

    buildings.selectPeriod("p1");
    expect(view().selected?.key).toBe("p1");

    stop();
  });

  it("lists Pozzetto's 12 suppliers by category, then name, and shows the first until another is selected", () => {
    const { buildingData, view, stop } = createPresented();

    buildingData.select("c19");

    expect(
      view().suppliers.map((supplier) => {
        return [supplier.category, supplier.id];
      }),
    ).toEqual([
      ["Antenna technician", "md86"],
      ["Certification bodies", "md84"],
      ["Cleaning company", "md82"],
      ["Condominium administration", "md76"],
      ["Electrician", "md119"],
      ["Electrician", "md80"],
      ["Electricity supply", "md15"],
      ["Elevator maintenance", "md78"],
      ["Fire protection", "md83"],
      ["Gas supply", "md79"],
      ["Hardware store", "md81"],
      ["Water supply", "md85"],
    ]);
    expect(view().supplier?.id).toBe("md86");

    buildingData.selectSupplier("md80");
    expect(view().supplier?.id).toBe("md80");

    // Saturno's suppliers do not hold md80: its first stands in.
    buildingData.select("c1");
    expect(view().suppliers).toHaveLength(6);
    expect(view().supplier?.id).toBe(view().suppliers[0]?.id);

    stop();
  });

  it("follows a period's edit in its row and in the sidebar's tree; its figures, wholly allocated, stay", async () => {
    const { harness, buildingData, view, stop } = createPresented();
    const { figures } = rowOf(view(), "p36");

    expect(
      await buildingData.editPeriod("p36", {
        ...createPeriodDraft(),
        name: "2013 bis",
        closed: true,
        end: "2013-06-30",
      }),
    ).toEqual({ ok: true });

    expect(rowOf(view(), "p36")).toMatchObject({
      label: "2013 bis (Ordinary)",
      closed: true,
      dates: "01/01/2013 - 30/06/2013",
      figures,
    });
    expect(
      harness.app.presenters.buildings.tree$.getValue()[1]?.periods[0]?.name,
    ).toBe("2013 bis");

    stop();
  });

  it("refuses dates that would cut r167's or r166's own, naming them", async () => {
    const { buildingData, stop } = createPresented();
    const { residents } = buildingData.periodContext("p36");

    expect(
      await buildingData.editPeriod("p36", {
        ...createPeriodDraft(),
        start: "2013-01-19",
      }),
    ).toEqual({
      ok: false,
      reason: "period-excludes",
      detail: residentName(residents, "r167"),
    });
    expect(
      await buildingData.editPeriod("p36", {
        ...createPeriodDraft(),
        end: "2013-01-18",
      }),
    ).toEqual({
      ok: false,
      reason: "period-excludes",
      detail: residentName(residents, "r166"),
    });

    stop();
  });

  it("stamps a building's edit and shows it in the profile", async () => {
    const { buildingData, view, stop } = createPresented();
    const saturno = must(view().building, "Saturno");

    expect(
      await buildingData.editBuilding("c1", {
        name: "Saturno Nord",
        code: saturno.code,
        status: saturno.status,
        type: saturno.type,
        address: saturno.address,
        taxCode: saturno.taxCode,
        constructionDate: saturno.constructionDate,
        cadastralData: saturno.cadastralData,
        notes: saturno.notes,
      }),
    ).toEqual({ ok: true });

    expect(view().building).toMatchObject({
      name: "Saturno Nord",
      modifiedOn: "2026-10-14 10:00:00",
    });

    stop();
  });

  it("holds what a period dialog is judged against: the building, the period, its units and residents", () => {
    const { buildingData, stop } = createPresented();
    const context = buildingData.periodContext("p1");

    expect(context.building.id).toBe("c1");
    expect(context.period.id).toBe("p1");
    expect(
      context.units.find((unit) => {
        return unit.code === "A1";
      })?.restriction,
    ).toEqual({ from: "2011-05-01", to: "2011-05-31" });
    expect(context.residents.length).toBeGreaterThan(0);
    expect(() => {
      return buildingData.periodContext("p999");
    }).toThrow("missing: the period p999");

    stop();
  });

  it("shows no row, building or supplier with no building", () => {
    const harness = createAppHarness({
      ...createAppHarness().seed,
      buildings: [],
    });
    const { buildingData } = harness.app.presenters;
    const subscription = buildingData.view$.subscribe();

    expect(buildingData.view$.getValue()).toEqual({
      rows: [],
      selected: null,
      building: null,
      suppliers: [],
      supplier: null,
    });

    subscription.unsubscribe();
  });
});

/** The app on the real seed with its building data presenter subscribed. */
interface Presented {
  harness: AppHarness;
  buildingData: BuildingDataPresenter;
  view: () => BuildingDataView;
  stop: () => void;
}

function createPresented(): Presented {
  const harness = createAppHarness();
  const { buildingData } = harness.app.presenters;
  const subscription = buildingData.view$.subscribe();

  return {
    harness,
    buildingData,
    view: (): BuildingDataView => {
      return buildingData.view$.getValue();
    },
    stop: (): void => {
      subscription.unsubscribe();
    },
  };
}

function rowOf(view: BuildingDataView, key: string): BuildingRow {
  return must(
    view.rows
      .flatMap((row) => {
        return [row, ...row.children];
      })
      .find((row) => {
        return row.key === key;
      }),
    `the row ${key}`,
  );
}

function residentName(residents: OwnerParty[], id: string): string {
  return must(
    residents.find((resident) => {
      return resident.id === id;
    }),
    `the resident ${id}`,
  ).name;
}

function childKeys(row: BuildingRow): string[] {
  return row.children.map((child) => {
    return child.key;
  });
}

/** Pozzetto 2013 as the seed has it. */
function createPeriodDraft(): PeriodDraft {
  return {
    name: "2013",
    type: "ordinary",
    closed: false,
    start: "2013-01-01",
    end: "2013-12-31",
    notes: null,
  };
}
