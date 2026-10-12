import { describe, expect, it } from "vitest";

import { type Building, createBuildingsSimulator } from "@cl/domain";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";

import {
  type BuildingsPresenter,
  createBuildingsPresenter,
  type PeriodSelection,
} from "./buildingsPresenter.ts";

describe("the buildings presenter", () => {
  it("answers the tree and selects the first building's first period until told otherwise", () => {
    const { latest } = createPresented(twoBuildings());

    expect(
      latest().tree.map((building) => {
        return building.id;
      }),
    ).toEqual(["c1", "c2"]);
    expect(latest().selected).toEqual({ buildingId: "c1", periodId: "p1" });
  });

  it("selects the period it is told, with its building", () => {
    const { presenter, latest } = createPresented(twoBuildings());

    presenter.selectPeriod("p2");

    expect(latest().selected).toEqual({ buildingId: "c2", periodId: "p2" });
  });

  it("errors, naming the id, for a period no building has", () => {
    const { presenter, errors } = createPresented(twoBuildings());

    presenter.selectPeriod("p9");

    expect(errors()).toEqual(["missing: the period p9"]);
  });

  it("selects nothing while there is no building", () => {
    const { latest } = createPresented([]);

    expect(latest().selected).toBeNull();
  });
});

interface Latest {
  tree: Building[];
  selected: PeriodSelection | null;
}

interface Presented {
  presenter: BuildingsPresenter;
  latest: () => Latest;
  errors: () => string[];
}

function createPresented(buildings: Building[]): Presented {
  const seed = { ...createSmallSeed(), buildings };
  const presenter = createBuildingsPresenter(createBuildingsSimulator(seed));
  let tree: Building[] = [];
  let selected: PeriodSelection | null = null;
  const errors: string[] = [];

  presenter.tree$.subscribe((next) => {
    tree = next;
  });
  presenter.selected$.subscribe({
    next: (next: PeriodSelection | null) => {
      selected = next;
    },
    error: (error: Error) => {
      errors.push(error.message);
    },
  });

  return {
    presenter,
    latest: () => {
      return { tree, selected };
    },
    errors: () => {
      return errors;
    },
  };
}

function twoBuildings(): Building[] {
  const period = {
    type: "ordinary" as const,
    start: "2013-01-01",
    end: "2013-12-31",
    closed: false,
  };

  return [
    {
      id: "c1",
      name: "Pozzetto",
      periods: [{ id: "p1", name: "2013", ...period }],
    },
    {
      id: "c2",
      name: "Saturno",
      periods: [{ id: "p2", name: "2011", ...period }],
    },
  ];
}
