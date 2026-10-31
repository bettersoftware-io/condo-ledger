import { BehaviorSubject, firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import {
  cents,
  type GroupDraft,
  type OwnerParty,
  type PeriodDates,
  type ResidencyDraft,
  type Result,
  type Unit,
  type UnitDraft,
  type UnitGroup,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { type AmountLocale, amountTextsIn } from "#/amounts.ts";
import { createAppHarness } from "#/testing/appHarness.ts";
import { createAmountTexts } from "#/testing/createAmountTexts.ts";
import { disposeAfterEach } from "#/testing/disposeAfterEach.ts";

import {
  createGroupDialog,
  createOwnerDialog,
  createUnitDialog,
} from "./unitDialogMachines.ts";

describe("the group dialog", () => {
  it("opens blank under its parent, and saves only once the code and the name are typed", () => {
    const machine = track(
      createGroupDialog(
        { groups: GROUPS, parentId: "ug1", editing: null },
        acceptAll,
      ),
    );

    expect(machine.state$.getValue()).toEqual({
      form: { code: "", name: "", address: null, notes: "" },
      canSave: false,
      verdict: { ok: false, reason: "blank-code" },
      touched: false,
      saving: false,
      editing: null,
    });

    machine.intents.edit({ code: "C" });
    expect(machine.state$.getValue().canSave).toBe(false);

    machine.intents.edit({ name: "Lift" });
    expect(machine.state$.getValue()).toMatchObject({
      canSave: true,
      verdict: { ok: true },
      touched: true,
    });
  });

  it("refuses a code or a name a sibling has, keeping the draft to word the reason", async () => {
    const writes: GroupDraft[] = [];
    const machine = track(
      createGroupDialog(
        { groups: GROUPS, parentId: null, editing: null },
        recording(writes),
      ),
    );

    machine.intents.edit({ code: " a ", name: "Lift" });
    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "group-taken",
      detail: "a",
    });
    expect(await machine.intents.save()).toEqual({
      ok: false,
      reason: "group-taken",
      detail: "a",
    });
    expect(machine.state$.getValue().form.code).toBe(" a ");

    machine.intents.edit({ code: "C", name: "garages" });
    expect(machine.state$.getValue().verdict).toMatchObject({
      reason: "group-taken",
      detail: "garages",
    });
    expect(writes).toEqual([]);
  });

  it("writes the draft trimmed, empty notes as none, with the address it holds", async () => {
    const writes: GroupDraft[] = [];
    const machine = track(
      createGroupDialog(
        { groups: GROUPS, parentId: null, editing: null },
        recording(writes),
      ),
    );
    const address = { street: "Via Roma, 1", postcode: null, city: null };

    machine.intents.edit({ code: " C ", name: " Lift ", address });

    expect(await machine.intents.save()).toEqual({ ok: true });
    expect(writes).toEqual([{ code: "C", name: "Lift", address, notes: null }]);
  });

  it("edits a group as it stands, its own code no clash", async () => {
    const writes: GroupDraft[] = [];
    const group = must(GROUPS[0], "group A");
    const machine = track(
      createGroupDialog(
        {
          groups: GROUPS,
          parentId: null,
          editing: { ...group, notes: "Lift" },
        },
        recording(writes),
      ),
    );

    expect(machine.state$.getValue()).toMatchObject({
      form: { code: "A", name: "Stairwell A", address: null, notes: "Lift" },
      verdict: { ok: true },
      canSave: true,
      editing: "ug1",
    });
    expect(await machine.intents.save()).toEqual({ ok: true });
    expect(writes).toEqual([
      { code: "A", name: "Stairwell A", address: null, notes: "Lift" },
    ]);
  });

  it("answers `saving` to a second save while the first runs, and can save again after", async () => {
    const pending = createPendingWrite<GroupDraft>();
    const machine = track(
      createGroupDialog(
        { groups: GROUPS, parentId: null, editing: null },
        pending.write,
      ),
    );

    machine.intents.edit({ code: "C", name: "Lift" });

    const first = machine.intents.save();

    expect(machine.state$.getValue()).toMatchObject({
      saving: true,
      canSave: false,
    });
    expect(await machine.intents.save()).toEqual({
      ok: false,
      reason: "saving",
    });

    pending.answer({ ok: false, reason: "group-taken", detail: "C" });
    expect(await first).toEqual({
      ok: false,
      reason: "group-taken",
      detail: "C",
    });
    expect(machine.state$.getValue().saving).toBe(false);
  });
});

describe("the unit dialog", () => {
  it("opens blank as an apartment, and saves once the code is typed", () => {
    const machine = track(
      createUnitDialog(
        { units: UNITS, residents: [OWNER], period: PERIOD, editing: null },
        acceptAll,
      ),
    );

    expect(machine.state$.getValue()).toEqual({
      form: {
        code: "",
        name: "",
        floor: "",
        interior: "",
        subUnit: "",
        start: "",
        end: "",
        type: "apartment",
        cadastralData: "",
        notes: "",
      },
      from: null,
      to: null,
      canSave: false,
      verdict: { ok: false, reason: "blank-code" },
      touched: false,
      saving: false,
      editing: null,
    });

    machine.intents.edit({ code: "A5" });
    expect(machine.state$.getValue()).toMatchObject({
      canSave: true,
      verdict: { ok: true },
    });
  });

  it.each([
    [{ code: "a1" }, "unit-code-taken"],
    [{ start: "31/2" }, "not-a-date"],
    [{ end: "soon" }, "not-a-date"],
    [{ start: "1/6", end: "1/5" }, "bad-dates"],
    [{ start: "1/1/2010" }, "outside-period"],
    [{ start: "1/6", end: "30/6/2011" }, null],
  ])("judges %j as %s", (patch, reason) => {
    const machine = track(
      createUnitDialog(
        { units: UNITS, residents: [OWNER], period: PERIOD, editing: null },
        acceptAll,
      ),
    );

    machine.intents.edit({ code: "A5", ...patch });

    const { verdict } = machine.state$.getValue();

    expect(verdict.ok ? null : verdict.reason).toBe(reason);
  });

  it("reads the dates in the period's year and writes the draft, blank fields as none", async () => {
    const writes: UnitDraft[] = [];
    const machine = track(
      createUnitDialog(
        { units: UNITS, residents: [OWNER], period: PERIOD, editing: null },
        recording(writes),
      ),
    );

    machine.intents.edit({
      code: " A5 ",
      floor: "2",
      start: "19/1",
      type: "garage",
    });

    expect(machine.state$.getValue()).toMatchObject({
      from: "2011-01-19",
      to: null,
    });
    expect(await machine.intents.save()).toEqual({ ok: true });
    expect(writes).toEqual([
      {
        code: "A5",
        name: null,
        floor: "2",
        interior: null,
        subUnit: null,
        restriction: { from: "2011-01-19", to: null },
        type: "garage",
        cadastralData: null,
        notes: null,
      },
    ]);
  });

  it("refuses dates that cut a resident's own, naming them; another unit's resident is none of its business", () => {
    const resident = {
      ...OWNER,
      ownRestriction: { from: "2011-05-10", to: null },
    };

    const elsewhere = {
      ...OWNER,
      id: "r2",
      unitId: "u2",
      name: "Owner Two",
      ownRestriction: { from: "2011-01-10", to: null },
    };

    const machine = track(
      createUnitDialog(
        {
          units: UNITS,
          residents: [elsewhere, resident],
          period: PERIOD,
          editing: must(UNITS[0], "A1"),
        },
        acceptAll,
      ),
    );

    machine.intents.edit({ start: "20/5" });
    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "period-excludes",
      detail: "Owner One",
    });

    machine.intents.edit({ start: "10/5" });
    expect(machine.state$.getValue().verdict).toEqual({ ok: true });
  });

  it("edits a unit as it stands, its dates as day/month/year, and refuses an unreadable one without writing", async () => {
    const writes: UnitDraft[] = [];
    const machine = track(
      createUnitDialog(
        {
          units: UNITS,
          residents: [OWNER],
          period: PERIOD,
          editing: must(UNITS[0], "A1"),
        },
        recording(writes),
      ),
    );

    expect(machine.state$.getValue()).toMatchObject({
      form: {
        code: "A1",
        name: "Shop",
        floor: "1",
        start: "01/05/2011",
        end: "31/05/2011",
        type: "shop",
      },
      verdict: { ok: true },
      editing: "u1",
    });

    machine.intents.edit({ end: "x" });
    expect(await machine.intents.save()).toEqual({
      ok: false,
      reason: "not-a-date",
    });

    machine.intents.edit({ start: "", end: "" });
    expect(await machine.intents.save()).toEqual({ ok: true });
    expect(writes[0]?.restriction).toBeNull();
  });
});

describe("the owner dialog", () => {
  it("adds an owner with a typed previous balance while no opening entry is posted", async () => {
    const writes: ResidencyDraft[] = [];
    const machine = track(
      createOwnerDialog(
        createAmountTexts(),
        createOwnerContext({ openingPosted: false }),
        recording(writes),
      ),
    );

    expect(machine.state$.getValue()).toEqual({
      form: {
        contactId: null,
        role: "PR",
        previousBalance: "",
        start: "",
        end: "",
      },
      from: null,
      to: null,
      unitDates: { start: "2011-05-01", end: "2011-05-31" },
      share: null,
      balanceLocked: false,
      canSave: false,
      verdict: { ok: false, reason: "not-an-amount" },
      touched: false,
      saving: false,
      editing: null,
    });

    machine.intents.edit({ contactId: "md6" });
    expect(machine.state$.getValue().canSave).toBe(false);

    machine.intents.edit({
      previousBalance: "-12.50",
      role: "CO",
      end: "30/5",
    });
    expect(machine.state$.getValue()).toMatchObject({
      canSave: true,
      verdict: { ok: true },
      to: "2011-05-30",
    });
    expect(await machine.intents.save()).toEqual({ ok: true });
    expect(writes).toEqual([
      {
        contactId: "md6",
        role: "CO",
        startingBalance: cents(-1250),
        ownRestriction: { from: null, to: "2011-05-30" },
      },
    ]);
  });

  it.each([
    [{ previousBalance: "1,2,3" }, "not-an-amount"],
    [{ contactId: null }, "no-contact"],
    [{ contactId: "md3" }, "already-resident"],
    [{ start: "40/1" }, "not-a-date"],
    [{ start: "1/7", end: "1/6" }, "bad-dates"],
    [{ end: "1/1/2012" }, "outside-period"],
    [{ start: "1/6", end: "31/12" }, "outside-unit"],
  ])("judges %j as %s", (patch, reason) => {
    const machine = track(
      createOwnerDialog(
        createAmountTexts(),
        createOwnerContext({ openingPosted: false }),
        acceptAll,
      ),
    );

    machine.intents.edit({ contactId: "md6", previousBalance: "0", ...patch });

    const { verdict } = machine.state$.getValue();

    expect(verdict.ok ? null : verdict.reason).toBe(reason);
  });

  it("locks the previous balance at 0 on an add once the opening entry is posted", async () => {
    const writes: ResidencyDraft[] = [];
    const machine = track(
      createOwnerDialog(
        createAmountTexts(),
        createOwnerContext({ openingPosted: true }),
        recording(writes),
      ),
    );

    expect(machine.state$.getValue()).toMatchObject({
      form: { previousBalance: "0.00" },
      balanceLocked: true,
    });

    machine.intents.edit({ contactId: "md6", previousBalance: "99" });
    expect(machine.state$.getValue()).toMatchObject({
      form: { previousBalance: "0.00" },
      canSave: true,
    });
    expect(await machine.intents.save()).toEqual({ ok: true });
    expect(writes[0]?.startingBalance).toBe(0);
  });

  it("edits an owner with its contact and role fixed, its share shown, its locked balance kept", async () => {
    const writes: ResidencyDraft[] = [];
    const machine = track(
      createOwnerDialog(
        createAmountTexts("it-IT"),
        createOwnerContext({ openingPosted: true, editing: OWNER }),
        recording(writes),
      ),
    );

    expect(machine.state$.getValue()).toMatchObject({
      form: {
        contactId: "md3",
        role: "PR",
        previousBalance: "30,00",
        start: "",
        end: "",
      },
      share: 500000,
      balanceLocked: true,
      canSave: true,
      editing: "r1",
    });

    machine.intents.edit({ contactId: "md6", role: "CO", start: "2/5" });
    expect(machine.state$.getValue().form).toMatchObject({
      contactId: "md3",
      role: "PR",
      start: "2/5",
    });
    expect(await machine.intents.save()).toEqual({ ok: true });
    expect(writes).toEqual([
      {
        contactId: "md3",
        role: "PR",
        startingBalance: cents(3000),
        ownRestriction: { from: "2011-05-02", to: null },
      },
    ]);
  });

  it("judges the previous balance again in the session's new locale", () => {
    const locale$ = new BehaviorSubject<AmountLocale>("en-US");
    const machine = track(
      createOwnerDialog(
        amountTextsIn(locale$),
        createOwnerContext({ openingPosted: false }),
        acceptAll,
      ),
    );

    machine.intents.edit({ contactId: "md6", previousBalance: "12,50" });
    expect(machine.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "not-an-amount",
    });

    locale$.next("it-IT");
    expect(machine.state$.getValue().verdict).toEqual({ ok: true });
  });
});

describe("the dialogs the application builds", () => {
  it("puts a new group and a new unit in the selected row's group, and at the top from the root", async () => {
    const { app, ports } = createAppHarness();
    const { units } = app.presenters;
    const subscription = units.view$.subscribe();

    app.presenters.buildings.selectPeriod("p1");
    units.select("unit:u5");

    const group = track(app.machines.createGroupDialog(null));

    group.intents.edit({ code: "C", name: "Lift" });
    expect(await group.intents.save()).toMatchObject({ ok: true });

    const unit = track(app.machines.createUnitDialog(null));

    unit.intents.edit({ code: "B5" });
    expect(await unit.intents.save()).toMatchObject({ ok: true });

    units.select("root");

    const top = track(app.machines.createUnitDialog(null));

    top.intents.edit({ code: "Z1" });
    expect(await top.intents.save()).toMatchObject({ ok: true });

    const groups = await firstValueFrom(ports.units.groups("p1"));
    const held = await firstValueFrom(ports.units.units("p1"));

    expect(groups.at(-1)).toMatchObject({ code: "C", parentId: "ug2" });
    expect(
      held.slice(-2).map((candidate) => {
        return [candidate.code, candidate.groupId];
      }),
    ).toEqual([
      ["B5", "ug2"],
      ["Z1", null],
    ]);

    subscription.unsubscribe();
  });

  it("edits the group and the unit it is asked for", async () => {
    const { app } = createAppHarness();
    const { units } = app.presenters;
    const subscription = units.view$.subscribe();

    app.presenters.buildings.selectPeriod("p1");

    const group = track(app.machines.createGroupDialog("ug2"));

    expect(group.state$.getValue().form.code).toBe("B");
    group.intents.edit({ name: "Parking" });
    expect(await group.intents.save()).toEqual({ ok: true });

    const unit = track(app.machines.createUnitDialog("u1"));

    expect(unit.state$.getValue().form.code).toBe("A1");
    unit.intents.edit({ floor: "2" });
    expect(await unit.intents.save()).toEqual({ ok: true });

    const view = must(units.view$.getValue(), "the units view");

    expect(view.list.root.children[1]?.label).toMatch(/^B - Parking/u);
    expect(view.list.root.children[0]?.children[0]?.floor).toBe("2");

    subscription.unsubscribe();
  });

  it("builds the owner dialog on p36 with the balance locked, for the selected unit or a resident", async () => {
    const { app } = createAppHarness();
    const { units } = app.presenters;

    app.presenters.buildings.selectPeriod("p36");

    const added = track(app.machines.createOwnerDialog(null));

    expect(added.state$.getValue()).toMatchObject({
      balanceLocked: true,
      form: { previousBalance: "0.00" },
    });
    added.intents.edit({ contactId: "md104" });
    expect(await added.intents.save()).toMatchObject({ ok: true });

    const edited = track(app.machines.createOwnerDialog("r166"));

    expect(edited.state$.getValue()).toMatchObject({
      balanceLocked: true,
      share: 1000000,
      editing: "r166",
    });
    expect(await edited.intents.save()).toEqual({ ok: true });

    units.select("root");
    expect(() => {
      return app.machines.createOwnerDialog(null);
    }).toThrow("missing: the unit of the new owner");
  });

  it("refuses A04 from 19 January on p36, naming r167, and an owner of A1 on p1 from June, naming A1", async () => {
    const { app } = createAppHarness();
    const { units } = app.presenters;
    const subscription = units.view$.subscribe();

    app.presenters.buildings.selectPeriod("p36");
    units.select("resident:r167");

    const name = must(units.view$.getValue()?.resident, "r167").name;
    const unit = track(app.machines.createUnitDialog("u137"));

    unit.intents.edit({ start: "19/1" });
    expect(unit.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "period-excludes",
      detail: name,
    });
    expect(await unit.intents.save()).toEqual({
      ok: false,
      reason: "period-excludes",
      detail: name,
    });

    app.presenters.buildings.selectPeriod("p1");

    const owner = track(app.machines.createOwnerDialog(null));

    expect(owner.state$.getValue().unitDates).toEqual({
      start: "2011-05-01",
      end: "2011-05-31",
    });
    owner.intents.edit({ contactId: "md6", start: "1/6", end: "31/12" });
    expect(owner.state$.getValue().verdict).toEqual({
      ok: false,
      reason: "outside-unit",
      detail: "A1",
    });

    subscription.unsubscribe();
  });

  it("throws for a group, a unit or an owner the period does not hold", () => {
    const { app } = createAppHarness();

    app.presenters.buildings.selectPeriod("p1");

    expect(() => {
      return app.machines.createGroupDialog("ug999");
    }).toThrow("missing: the group ug999");
    expect(() => {
      return app.machines.createUnitDialog("u999");
    }).toThrow("missing: the unit u999");
    expect(() => {
      return app.machines.createOwnerDialog("r999");
    }).toThrow("missing: the resident r999");
  });
});

/** Saturno 2011's dates. */
const PERIOD: PeriodDates = { start: "2011-01-01", end: "2011-12-31" };

const GROUPS: UnitGroup[] = [
  createGroup("ug1", "A", "Stairwell A", null),
  createGroup("ug2", "B", "Garages", null),
];

const UNITS: Unit[] = [
  {
    ...createUnit("u1", "A1"),
    name: "Shop",
    floor: "1",
    type: "shop",
    restriction: { from: "2011-05-01", to: "2011-05-31" },
  },
  createUnit("u2", "A2"),
];

const OWNER: OwnerParty = {
  kind: "owner",
  id: "r1",
  personId: "md3",
  name: "Owner One",
  unitCode: "A1",
  unitId: "u1",
  startingBalance: cents(3000),
  role: "PR",
  share: 500000,
  restriction: null,
  ownRestriction: null,
};

/** What an owner dialog on A1 is built over. */
interface OwnerContextOptions {
  openingPosted: boolean;
  editing?: OwnerParty;
}

function createOwnerContext({
  openingPosted,
  editing,
}: OwnerContextOptions): Parameters<typeof createOwnerDialog>[1] {
  return {
    unit: must(UNITS[0], "A1"),
    residents: [OWNER],
    period: PERIOD,
    openingPosted,
    editing: editing ?? null,
  };
}

function createGroup(
  id: string,
  code: string,
  name: string,
  parentId: string | null,
): UnitGroup {
  return {
    id,
    periodId: "p1",
    code,
    name,
    parentId,
    address: null,
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

/** A write that answers only when the test says so. */
interface PendingWrite<TDraft> {
  write: (draft: TDraft) => Promise<Result>;
  answer: (result: Result) => void;
}

function createPendingWrite<TDraft>(): PendingWrite<TDraft> {
  const answers: ((result: Result) => void)[] = [];

  return {
    write: (): Promise<Result> => {
      return new Promise((resolve) => {
        answers.push(resolve);
      });
    },
    answer: (result: Result): void => {
      must(answers.shift(), "a pending write")(result);
    },
  };
}

const track = disposeAfterEach();
