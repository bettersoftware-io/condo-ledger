import { describe, expect, it } from "vitest";

import {
  type Address,
  type Building,
  type BuildingDraft,
  cents,
  type OwnerParty,
  type Period,
  type PeriodDraft,
  type Result,
  type Unit,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { createAppHarness } from "#/testing/appHarness.ts";
import { disposeAfterEach } from "#/testing/disposeAfterEach.ts";

import {
  createAddressDialog,
  createBuildingDialog,
  createPeriodDialog,
} from "./buildingDialogMachines.ts";

describe("the building dialog", () => {
  it("opens on the building as it stands, and saves only while it has a name", () => {
    const machine = track(
      createBuildingDialog(
        { buildings: BUILDINGS, editing: SATURNO, year: 2026 },
        acceptAll,
      ),
    );

    expect(machine.state$.getValue()).toMatchObject({
      form: {
        name: "Saturno",
        code: "SAT",
        status: "active",
        type: "building",
        address: SATURNO.address,
        taxCode: "",
        constructionDate: "20/05/1980",
        cadastralData: "",
        notes: "",
      },
      constructedOn: "1980-05-20",
      verdict: { ok: true },
      canSave: true,
      touched: false,
      editing: "c1",
    });

    machine.intents.edit({ name: "  " });

    expect(machine.state$.getValue()).toMatchObject({
      verdict: { ok: false, reason: "blank-name" },
      canSave: false,
      touched: true,
    });
  });

  it.each([
    {
      patch: { name: " pozzetto " },
      verdict: { ok: false, reason: "building-name-taken", detail: "pozzetto" },
    },
    {
      patch: { code: "POZ" },
      verdict: { ok: false, reason: "building-code-taken", detail: "POZ" },
    },
    {
      patch: { address: { street: " ", postcode: null, city: null } },
      verdict: { ok: false, reason: "blank-street" },
    },
    {
      patch: { constructionDate: "31/02/1980" },
      verdict: { ok: false, reason: "not-a-date" },
    },
  ])(
    "refuses $verdict.reason as the port would, without writing",
    async ({ patch, verdict }) => {
      const writes: BuildingDraft[] = [];
      const machine = track(
        createBuildingDialog(
          { buildings: BUILDINGS, editing: SATURNO, year: 2026 },
          recording(writes),
        ),
      );

      machine.intents.edit(patch);

      expect(machine.state$.getValue().verdict).toEqual(verdict);
      expect(await machine.intents.save()).toEqual(verdict);
      expect(writes).toEqual([]);
    },
  );

  it("writes the draft trimmed, blank fields as none, the date as it reads", async () => {
    const writes: BuildingDraft[] = [];
    const machine = track(
      createBuildingDialog(
        { buildings: BUILDINGS, editing: SATURNO, year: 2026 },
        recording(writes),
      ),
    );

    machine.intents.edit({
      name: " Saturno Nord ",
      code: " ",
      status: "archived",
      type: "residence",
      address: null,
      taxCode: " 80012345678 ",
      constructionDate: "1/3",
      cadastralData: " F. 12 ",
      notes: " Lift ",
    });

    expect(machine.state$.getValue().constructedOn).toBe("2026-03-01");
    expect(await machine.intents.save()).toEqual({ ok: true });
    expect(writes).toEqual([
      {
        name: "Saturno Nord",
        code: null,
        status: "archived",
        type: "residence",
        address: null,
        taxCode: "80012345678",
        constructionDate: "2026-03-01",
        cadastralData: "F. 12",
        notes: "Lift",
      },
    ]);

    machine.intents.edit({ constructionDate: "" });
    expect(machine.state$.getValue().constructedOn).toBeNull();
    expect(await machine.intents.save()).toEqual({ ok: true });
    expect(writes[1]?.constructionDate).toBeNull();
  });
});

describe("the period dialog", () => {
  it("opens on the period as it stands, and saves only with a name and both dates", () => {
    const machine = track(createPeriodDialog(createPeriodContext(), acceptAll));

    expect(machine.state$.getValue()).toMatchObject({
      form: {
        name: "2011",
        type: "ordinary",
        closed: false,
        start: "01/01/2011",
        end: "31/12/2011",
        notes: "",
      },
      from: "2011-01-01",
      to: "2011-12-31",
      verdict: { ok: true },
      canSave: true,
      editing: "p1",
    });

    for (const patch of [{ name: " " }, { start: "" }, { end: " " }]) {
      machine.intents.edit({ name: "2011", start: "1/1", end: "31/12" });
      expect(machine.state$.getValue().canSave).toBe(true);

      machine.intents.edit(patch);
      expect(machine.state$.getValue().canSave).toBe(false);
    }
  });

  it.each([
    {
      patch: { name: " 2010 " },
      verdict: { ok: false, reason: "period-name-taken", detail: "2010" },
    },
    {
      patch: { start: "1/7", end: "30/6" },
      verdict: { ok: false, reason: "bad-dates" },
    },
    {
      patch: { start: "01/06/2011" },
      verdict: { ok: false, reason: "period-excludes", detail: "A1" },
    },
    {
      patch: { end: "31/08/2011" },
      verdict: { ok: false, reason: "period-excludes", detail: "Owner Two" },
    },
    {
      patch: { end: "32/12" },
      verdict: { ok: false, reason: "not-a-date" },
    },
    {
      patch: { start: " " },
      verdict: { ok: false, reason: "not-a-date" },
    },
  ])(
    "refuses $verdict.reason as the port would, without writing",
    async ({ patch, verdict }) => {
      const writes: PeriodDraft[] = [];
      const machine = track(
        createPeriodDialog(createPeriodContext(), recording(writes)),
      );

      machine.intents.edit(patch);

      expect(machine.state$.getValue().verdict).toEqual(verdict);
      expect(await machine.intents.save()).toEqual(verdict);
      expect(writes).toEqual([]);
    },
  );

  it("writes the draft with the dates in the period's year, empty notes as none", async () => {
    const writes: PeriodDraft[] = [];
    const machine = track(
      createPeriodDialog(createPeriodContext(), recording(writes)),
    );

    machine.intents.edit({
      name: " 2011 bis ",
      type: "extra",
      closed: true,
      start: "1/5",
      end: "30/11",
      notes: " ",
    });

    expect(await machine.intents.save()).toEqual({ ok: true });
    expect(writes).toEqual([
      {
        name: "2011 bis",
        type: "extra",
        closed: true,
        start: "2011-05-01",
        end: "2011-11-30",
        notes: null,
      },
    ]);
  });
});

describe("the address dialog", () => {
  it("opens blank, and saves once the street is typed, trimmed, a blank postcode or city as none", async () => {
    const writes: Address[] = [];
    const machine = track(createAddressDialog(null, recording(writes)));

    expect(machine.state$.getValue()).toMatchObject({
      form: { street: "", postcode: "", city: "" },
      verdict: { ok: false, reason: "blank-street" },
      canSave: false,
    });

    machine.intents.edit({
      street: " Via Roma, 1 ",
      postcode: " ",
      city: "Udine",
    });

    expect(machine.state$.getValue().canSave).toBe(true);
    expect(await machine.intents.save()).toEqual({ ok: true });
    expect(writes).toEqual([
      { street: "Via Roma, 1", postcode: null, city: "Udine" },
    ]);
  });

  it("opens on the address it is given", () => {
    const machine = track(createAddressDialog(SATURNO.address, acceptAll));

    expect(machine.state$.getValue().form).toEqual({
      street: "Piazza del Duomo, 39",
      postcode: "33033",
      city: "Codroipo",
    });
  });
});

describe("the dialogs the application builds", () => {
  it("edits the building it is asked for, stamped, and throws for one it does not hold", async () => {
    const { app } = createAppHarness();
    const machine = track(app.machines.createBuildingDialog("c1"));

    expect(machine.state$.getValue().form.code).toBe("SAT");
    machine.intents.edit({ name: "Saturno Nord" });
    expect(await machine.intents.save()).toEqual({ ok: true });

    expect(
      app.presenters.buildings.tree$.getValue().find((building) => {
        return building.id === "c1";
      }),
    ).toMatchObject({
      name: "Saturno Nord",
      modifiedOn: "2026-10-14 10:00:00",
    });
    expect(() => {
      return app.machines.createBuildingDialog("c999");
    }).toThrow("missing: the building c999");
  });

  it("refuses Saturno 2011 starting on 1 June: A1's May would be cut", async () => {
    const { app } = createAppHarness();
    const machine = track(app.machines.createPeriodDialog("p1"));

    machine.intents.edit({ start: "01/06/2011" });

    const refusal = { ok: false, reason: "period-excludes", detail: "A1" };

    expect(machine.state$.getValue().verdict).toEqual(refusal);
    expect(await machine.intents.save()).toEqual(refusal);
  });

  it("refuses Pozzetto 2013 cutting r167's days or r166's, naming the resident", async () => {
    const { app } = createAppHarness();
    const { residents } = app.presenters.buildingData.periodContext("p36");

    for (const { patch, residentId } of [
      { patch: { start: "19/01/2013" }, residentId: "r167" },
      { patch: { end: "18/01/2013" }, residentId: "r166" },
    ]) {
      const machine = track(app.machines.createPeriodDialog("p36"));
      const refusal = {
        ok: false,
        reason: "period-excludes",
        detail: residentName(residents, residentId),
      };

      machine.intents.edit(patch);

      expect(machine.state$.getValue().verdict).toEqual(refusal);
      expect(await machine.intents.save()).toEqual(refusal);
    }
  });

  it("renames Pozzetto 2013 in the sidebar's tree, and throws for a period it does not hold", async () => {
    const { app } = createAppHarness();
    const machine = track(app.machines.createPeriodDialog("p36"));

    machine.intents.edit({ name: "2013 bis" });
    expect(await machine.intents.save()).toEqual({ ok: true });

    expect(
      app.presenters.buildings.tree$
        .getValue()
        .flatMap((building) => {
          return building.periods;
        })
        .find((period) => {
          return period.id === "p36";
        })?.name,
    ).toBe("2013 bis");
    expect(() => {
      return app.machines.createPeriodDialog("p999");
    }).toThrow("missing: the period p999");
  });

  it("hands the address saved to the building dialog's form", async () => {
    const { app } = createAppHarness();
    const building = track(app.machines.createBuildingDialog("c1"));
    const address = track(
      app.machines.createAddressDialog(
        building.state$.getValue().form.address,
        (saved) => {
          building.intents.edit({ address: saved });
        },
      ),
    );

    address.intents.edit({ city: "Udine" });
    expect(await address.intents.save()).toEqual({ ok: true });
    expect(building.state$.getValue().form.address).toEqual({
      street: "Piazza del Duomo, 39",
      postcode: "33033",
      city: "Udine",
    });
  });
});

const SATURNO: Building = createBuilding("c1", "Saturno", "SAT", {
  constructionDate: "1980-05-20",
  address: {
    street: "Piazza del Duomo, 39",
    postcode: "33033",
    city: "Codroipo",
  },
  periods: [
    createPeriod("p1", "2011", "2011-01-01", "2011-12-31"),
    createPeriod("p0", "2010", "2010-01-01", "2010-12-31"),
  ],
});

const BUILDINGS: Building[] = [
  SATURNO,
  createBuilding("c19", "Pozzetto", "POZ", {}),
];

/** Saturno 2011 with A1 restricted to May, and a resident who moves in on 1 September. */
function createPeriodContext(): Parameters<typeof createPeriodDialog>[0] {
  return {
    building: SATURNO,
    period: must(SATURNO.periods[0], "p1"),
    units: [
      {
        ...createUnit("u1", "A1"),
        restriction: { from: "2011-05-01", to: "2011-05-31" },
      },
      createUnit("u2", "A2"),
    ],
    residents: [createResident("r2", "Owner Two", "2011-09-01")],
  };
}

function createBuilding(
  id: string,
  name: string,
  code: string | null,
  overrides: Partial<Building>,
): Building {
  return {
    id,
    name,
    code,
    type: "building",
    status: "active",
    address: null,
    taxCode: null,
    constructionDate: null,
    cadastralData: null,
    notes: null,
    createdOn: "2010-01-01 09:00:00",
    modifiedOn: "2010-01-01 09:00:00",
    periods: [],
    ...overrides,
  };
}

function createPeriod(
  id: string,
  name: string,
  start: string,
  end: string,
): Period {
  return {
    id,
    name,
    type: "ordinary",
    start,
    end,
    closed: false,
    notes: null,
  };
}

function createUnit(id: string, code: string): Unit {
  return {
    id,
    periodId: "p1",
    code,
    groupId: null,
    restriction: null,
    name: null,
    floor: null,
    interior: null,
    subUnit: null,
    type: "apartment",
    cadastralData: null,
    notes: null,
  };
}

function createResident(id: string, name: string, from: string): OwnerParty {
  return {
    kind: "owner",
    id,
    personId: "md6",
    name,
    unitCode: "A2",
    unitId: "u2",
    startingBalance: cents(0),
    role: "PR",
    share: null,
    restriction: { from, to: null },
    ownRestriction: { from, to: null },
  };
}

function residentName(residents: OwnerParty[], id: string): string {
  return must(
    residents.find((resident) => {
      return resident.id === id;
    }),
    `the resident ${id}`,
  ).name;
}

function acceptAll(): Promise<Result> {
  return Promise.resolve({ ok: true });
}

/** A write that keeps each draft it is handed, and accepts it. */
function recording<TDraft>(
  writes: TDraft[],
): (draft: TDraft) => Promise<Result> {
  return (draft: TDraft): Promise<Result> => {
    writes.push(draft);

    return Promise.resolve({ ok: true });
  };
}

const track = disposeAfterEach();
