import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import {
  type Cents,
  cents,
  type EntryDraft,
  fixedClock,
  type JournalEntryView,
  type LegacySeed,
  loadLegacySeed,
  type ResultOf,
} from "@cl/domain";
import type { Added } from "@cl/domain/ports/unitsPort.ts";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";
import { must } from "@cl/domain/support/must.ts";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";
import { createTwoPeriodSeed } from "@cl/domain/testing/createTwoPeriodSeed.ts";
import type {
  ResidencyDraft,
  UnitDraft,
} from "@cl/domain/useCases/validateUnits.ts";

import { type AppPorts, createSimulatorPorts } from "./composition.ts";
import { createAppHarness } from "./testing/appHarness.ts";

describe("the application", () => {
  it("wires the accounts presenter to the selected period", () => {
    const { app } = createAppHarness(createSmallSeed());
    const subscription = app.presenters.accounts.tree$.subscribe();

    expect(app.presenters.accounts.tree$.getValue()?.debit).toBe(212619);

    subscription.unsubscribe();
  });

  it("wires the journal presenter to the selected period, stamping with the application's clock", async () => {
    const { app } = createAppHarness(createSmallSeed());
    let entries: JournalEntryView[] = [];
    const subscription = app.presenters.journal.entries$.subscribe((next) => {
      entries = next;
    });

    expect(
      await app.presenters.journal.addEntry({
        kind: "generic",
        description: "Prova",
        postings: [
          {
            accountId: "la21",
            debit: cents(100),
            credit: cents(0),
            counterpart: null,
          },
          {
            accountId: "la1",
            debit: cents(0),
            credit: cents(100),
            counterpart: null,
          },
        ],
      }),
    ).toEqual({ ok: true, value: { id: "new1" } });
    expect(entries.at(-1)).toMatchObject({
      id: "new1",
      number: 10,
      at: "2026-10-14T10:00:00",
    });

    subscription.unsubscribe();
  });

  it("builds the journal grid over the selected period's entries, and a dialog machine per call", () => {
    const { app } = createAppHarness(createSmallSeed());
    const grid = app.screens.journalGrid();
    const first = app.machines.createJournalDialog();
    const second = app.machines.createJournalDialog();

    first.intents.openDelete();

    expect(grid.state$.getValue().total).toBe(9);
    expect(first.state$.getValue().open).toEqual({ kind: "delete" });
    expect(second.state$.getValue().open).toBeNull();

    first.dispose();
    second.dispose();
  });

  it("a wizard built after a period is selected has that period's choices", () => {
    const { app } = createAppHarness(createSmallSeed());

    app.presenters.buildings.selectPeriod("p1");
    const wizard = app.machines.createDirectPaymentWizard("directPaymentCash");

    expect(wizard.state$.getValue().choices).toHaveLength(2);
    expect(wizard.state$.getValue().summary).toEqual({ paidFrom: "Cassa" });

    wizard.dispose();
  });

  it("a wizard is built over the books of the period selected when it is built", () => {
    const { app } = createAppHarness(createTwoPeriodSeed());

    // p2 holds a cash account and no expense leaf.
    app.presenters.buildings.selectPeriod("p2");
    const onP2 = app.machines.createDirectPaymentWizard("directPaymentCash");

    app.presenters.buildings.selectPeriod("p1");
    const onP1 = app.machines.createDirectPaymentWizard("directPaymentCash");

    expect(onP2.state$.getValue()).toMatchObject({
      choices: [],
      summary: { paidFrom: "Cassa" },
    });
    expect(onP1.state$.getValue().choices).toHaveLength(2);

    onP2.dispose();
    onP1.dispose();
  });

  it("one built with no period has none and is refused", async () => {
    const { app } = createAppHarness(createSeedWithNoBuilding());
    const direct = app.machines.createDirectPaymentWizard("directPaymentBank");
    const multiCost = app.machines.createMultiCostPaymentWizard();
    const generic = app.machines.createGenericEntryWizard();

    expect(direct.state$.getValue()).toMatchObject({
      choices: [],
      verdict: { ok: false, reason: "no-paid-from-account" },
      summary: { paidFrom: null },
    });
    expect(multiCost.state$.getValue()).toMatchObject({
      choices: [],
      verdict: { ok: false, reason: "no-paid-from-account" },
    });
    expect(generic.state$.getValue()).toMatchObject({
      choices: [],
      verdict: { ok: false },
    });
    expect(await direct.intents.save()).toEqual({
      ok: false,
      reason: "no-paid-from-account",
    });

    direct.dispose();
    multiCost.dispose();
    generic.dispose();
  });

  it("a wizard asked to edit an entry the selected period does not hold is not built", () => {
    const { app } = createAppHarness(createSmallSeed());
    const { app: withNoPeriod } = createAppHarness(createSeedWithNoBuilding());

    expect(() => {
      return app.machines.createMultiCostPaymentWizard("nope");
    }).toThrow("missing: the entry nope");
    expect(() => {
      return withNoPeriod.machines.createGenericEntryWizard("e9");
    }).toThrow("missing: the entry e9");
  });

  it("runs on the real seed by default", () => {
    expect(createAppHarness().seed.buildings).toHaveLength(2);
  });
});

describe("the simulator ports over the real seed", () => {
  it("an installment a collection pays refuses delete; once the journal deletes the collection, it goes", async () => {
    const { installments, journal } = createRealPorts();
    // Installment 12 of Pozzetto 2013: nothing paid on it yet.
    const added = await journal.addEntry(
      "p36",
      createCollection("r163", "ii845", cents(5000)),
    );
    const id = added.ok ? added.value.id : "";

    expect(added.ok).toBe(true);
    expect(await installments.deleteInstallment("in36")).toEqual({
      ok: false,
      reason: "installment-paid",
    });
    expect(await journal.deleteEntry(id)).toEqual({ ok: true });
    expect(await installments.deleteInstallment("in36")).toEqual({ ok: true });
    expect(
      await journal.addEntry(
        "p36",
        createCollection("r163", "ii845", cents(5000)),
      ),
    ).toEqual({ ok: false, reason: "unknown-item" });
  });

  it("a collection is judged against the schedule as edited: an item lowered to 10.00 refuses 20.00 with over-remaining-item", async () => {
    const untouched = createRealPorts();
    const edited = createRealPorts();

    // Untouched, r162's ii844 on Installment 12 owes 134.98, and 20.00 of it is accepted.
    expect(
      await untouched.journal.addEntry(
        "p36",
        createCollection("r162", "ii844", cents(2000)),
      ),
    ).toMatchObject({ ok: true });
    expect(
      await edited.installments.setItemAmount("ii844", cents(1000)),
    ).toEqual({ ok: true });
    expect(
      await edited.journal.addEntry(
        "p36",
        createCollection("r162", "ii844", cents(2000)),
      ),
    ).toEqual({ ok: false, reason: "over-remaining-item" });
  });

  it("wires the tables to the accounts as they stand: dt14 is linked, a new table is not", async () => {
    const { tables, units } = createRealPorts();
    const added = await tables.addTable("p36", {
      name: "Test",
      order: 99,
      notes: "",
    });

    expect(await tables.deleteTable("dt14")).toMatchObject({
      reason: "table-linked",
      detail: "la172",
    });
    expect(added.ok).toBe(true);
    expect(await tables.deleteTable(added.ok ? added.value.id : "")).toEqual({
      ok: true,
    });
    expect((await firstValueFrom(units.units("p36"))).length).toBe(18);
  });

  it("gives a unit added to Pozzetto 2013 a 0 coefficient in each of its 12 tables, and takes a coefficient for it", async () => {
    const { tables, units } = createRealPorts();
    const id = addedId(
      await units.addUnit("p36", null, createUnitDraft("A19")),
    );

    const ofNew = (await firstValueFrom(tables.coefficients("p36"))).filter(
      (coefficient) => {
        return coefficient.unitId === id;
      },
    );

    expect(ofNew).toHaveLength(12);
    expect(
      ofNew.every((coefficient) => {
        return coefficient.value === 0;
      }),
    ).toBe(true);
    expect(
      await tables.setCoefficient(
        must(ofNew[0], "a coefficient of A19").tableId,
        id,
        25000,
      ),
    ).toEqual({ ok: true });
  });

  it("a resident added to a new unit is among the parties, a new batch plans an item for it, and a collection on that item is accepted", async () => {
    const { accounts, installments, journal, units } = createRealPorts();
    const seen: string[][] = [];
    const subscription = accounts.parties("p36").subscribe((parties) => {
      seen.push(
        parties.map((party) => {
          return party.id;
        }),
      );
    });

    const unitId = addedId(
      await units.addUnit("p36", null, createUnitDraft("A19")),
    );

    const residentId = addedId(
      await units.addResident(unitId, createResidencyDraft("md104")),
    );

    subscription.unsubscribe();

    expect(seen).toHaveLength(2);
    expect(seen[0]?.includes(residentId)).toBe(false);
    expect(seen[1]?.at(-1)).toBe(residentId);
    expect(
      await installments.createInstallments("p36", {
        installments: [
          { name: "Extra", dueDate: "2013-12-15", percentage: 10000 },
        ],
        wholeEuros: false,
      }),
    ).toEqual({ ok: true });

    const item = must(
      (await firstValueFrom(installments.items("p36"))).find((candidate) => {
        return candidate.residentId === residentId;
      }),
      "the new resident's item",
    );

    expect(await installments.setItemAmount(item.id, cents(5000))).toEqual({
      ok: true,
    });
    expect(
      await journal.addEntry(
        "p36",
        createCollection(residentId, item.id, cents(5000)),
      ),
    ).toMatchObject({ ok: true });
  });

  it("refuses to delete r166, whom the journal names; a resident and a unit added go, the unit's coefficients with it", async () => {
    const { tables, units } = createRealPorts();

    expect(await units.deleteResident("r166")).toMatchObject({
      ok: false,
      reason: "named-in-journal",
    });

    const unitId = addedId(
      await units.addUnit("p36", null, createUnitDraft("A19")),
    );

    const residentId = addedId(
      await units.addResident(unitId, createResidencyDraft("md104")),
    );

    expect(await units.deleteResident(residentId)).toEqual({ ok: true });
    expect(await units.deleteUnit(unitId)).toEqual({ ok: true });
    expect(
      (await firstValueFrom(tables.coefficients("p36"))).some((coefficient) => {
        return coefficient.unitId === unitId;
      }),
    ).toBe(false);
  });
});

/** The simulator ports over the real seed, each built afresh. */
function createRealPorts(): AppPorts {
  return createSimulatorPorts(
    loadLegacySeed(legacySeedData),
    fixedClock("2026-10-14T08:00:00Z"),
  );
}

/** A collection into Pozzetto 2013's bank (la156), credited to the owners account (la158) on one resident's item. */
function createCollection(
  residentId: string,
  itemId: string,
  amount: Cents,
): EntryDraft {
  return {
    kind: "collection",
    description: `Incasso ${residentId}`,
    postings: [
      {
        accountId: "la156",
        debit: amount,
        credit: cents(0),
        counterpart: null,
      },
      {
        accountId: "la158",
        debit: cents(0),
        credit: amount,
        counterpart: { kind: "owner", id: residentId },
        installmentItemId: itemId,
      },
    ],
  };
}

/** The small seed's books with no building to hold them: nothing is selected. */
function createSeedWithNoBuilding(): LegacySeed {
  return { ...createSmallSeed(), buildings: [] };
}

/** The id an accepted add answers; throws with the reason of a refused one. */
function addedId(result: ResultOf<Added>): string {
  if (!result.ok) {
    throw new Error(`refused: ${result.reason}`);
  }

  return result.value.id;
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
