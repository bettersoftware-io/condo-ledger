import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import { cents } from "#/entities/cents.ts";
import type { Contact } from "#/entities/contact.ts";
import type { InstallmentItem } from "#/entities/installment.ts";
import type { JournalEntry } from "#/entities/journal.ts";
import type { Restriction } from "#/entities/party.ts";
import type { ResultOf } from "#/entities/result.ts";
import type { Added } from "#/ports/unitsPort.ts";
import type { PeriodDates } from "#/useCases/schedule.ts";
import type {
  GroupDraft,
  ResidencyDraft,
  UnitDraft,
} from "#/useCases/validateUnits.ts";

import { createTablesSeed } from "../testing/createTablesSeed.ts";
import { createUnitsSeed } from "../testing/createUnitsSeed.ts";
import { createUnitsSimulator } from "./unitsSimulator.ts";

describe("units simulator", () => {
  it("answers no units, groups or residents for a period that has none", async () => {
    const units = createUnitsSimulator(createTablesSeed());

    expect(await firstValueFrom(units.units("p2"))).toEqual([]);
    expect(await firstValueFrom(units.groups("p2"))).toEqual([]);
    expect(await firstValueFrom(units.residents("p2"))).toEqual([]);
  });

  it("answers the seed's residents of the period, its suppliers left out", async () => {
    const units = createUnitsSimulator(createUnitsSeed());

    expect(
      (await firstValueFrom(units.residents("p1"))).map((resident) => {
        return resident.id;
      }),
    ).toEqual(["r1", "r2", "r3", "r4"]);
  });

  it("gives what it adds ids of its own, never a seeded one", async () => {
    const units = createUnitsSimulator(createUnitsSeed());

    const groups = [
      await units.addGroup("p1", null, createGroupDraft("G1")),
      await units.addGroup("p1", null, createGroupDraft("G2")),
    ];

    const added = [
      await units.addUnit("p1", null, createUnitDraft("Z1")),
      await units.addUnit("p1", null, createUnitDraft("Z2")),
    ];

    const residents = [
      await units.addResident("uA01", createResidencyDraft("md12")),
      await units.addResident("uA02", createResidencyDraft("md12")),
    ];

    expect(
      [...groups, ...added, ...residents].map((result) => {
        return result.ok ? result.value.id : result.reason;
      }),
    ).toEqual([
      "ug-new-1",
      "ug-new-2",
      "u-new-1",
      "u-new-2",
      "r-new-1",
      "r-new-2",
    ]);
  });

  it("answers its current units and residents, writes included, and fails for a period it does not have", async () => {
    const units = createUnitsSimulator(createUnitsSeed());

    await units.addUnit("p1", null, createUnitDraft("Z1"));
    await units.deleteResident(
      must(await units.addResident("uA01", createResidencyDraft("md12"))),
    );

    expect(
      units.currentUnits("p1").map((unit) => {
        return unit.code;
      }),
    ).toEqual(["A01", "A02", "B01", "Z1"]);
    expect(
      units.currentResidents("p1").map((resident) => {
        return resident.id;
      }),
    ).toEqual(["r1", "r2", "r3", "r4"]);
    expect(() => {
      return units.currentUnits("p99");
    }).toThrow("missing: the period p99");
    expect(() => {
      return units.currentResidents("p99");
    }).toThrow("missing: the period p99");
  });

  it("judges a delete against the journal and the items as the readers answer them now: a resident goes once nothing names it", async () => {
    const seed = createUnitsSeed();
    let entries: JournalEntry[] = seed.entries;
    let items: InstallmentItem[] = seed.installmentItems;
    const units = createUnitsSimulator(seed, {
      entriesOf: () => {
        return entries;
      },
      itemsOf: () => {
        return items;
      },
    });

    expect(await units.deleteResident("r1")).toMatchObject({
      reason: "named-in-journal",
    });
    entries = [];
    expect(await units.deleteResident("r1")).toMatchObject({
      reason: "has-installments",
    });
    items = [];
    expect(await units.deleteResident("r1")).toEqual({ ok: true });
    expect(await units.deleteUnit("uA02")).toEqual({ ok: true });
    expect(
      (await firstValueFrom(units.residents("p1"))).map((resident) => {
        return resident.id;
      }),
    ).toEqual(["r3", "r4"]);
  });

  it("judges dates against the period as the reader answers it, and names a resident from the reader's contacts", async () => {
    const seed = createUnitsSeed();
    const units = createUnitsSimulator(seed, {
      periodOf: (): PeriodDates => {
        return { start: "2013-01-01", end: "2013-06-30" };
      },
      contactsOf: (): Contact[] => {
        return [
          ...seed.contacts,
          {
            id: "md99",
            kind: "person",
            name: "Gialli Ugo",
            status: "active",
            code: null,
            category: null,
            companyName: null,
            registeredOffice: null,
            taxDomicile: null,
            phone: null,
            email: null,
          },
        ];
      },
    });
    const july = { from: "2013-07-01", to: null };

    expect(
      await units.addUnit("p1", null, createUnitDraft("Z1", july)),
    ).toEqual({ ok: false, reason: "outside-period" });
    expect(
      await units.addResident("uA01", createResidencyDraft("md12", july)),
    ).toEqual({ ok: false, reason: "outside-period" });

    const added = must(
      await units.addResident("uA01", createResidencyDraft("md99")),
    );

    expect(
      units.currentResidents("p1").find((resident) => {
        return resident.id === added;
      })?.name,
    ).toBe("Gialli Ugo");
  });

  it("keeps a resident's own dates when its unit's change, and lets a unit's dates go back to none", async () => {
    const units = createUnitsSimulator(createUnitsSeed());
    const own = { from: "2013-03-01", to: null };
    const resident = must(
      await units.addResident("uB01", createResidencyDraft("md12", own)),
    );

    await units.editUnit(
      "uB01",
      createUnitDraft("B01", { from: "2013-02-01", to: null }),
    );
    await units.editUnit("uB01", createUnitDraft("B1"));

    expect(
      units.currentResidents("p1").map((candidate) => {
        return [candidate.id, candidate.unitCode, candidate.restriction];
      }),
    ).toEqual([
      ["r1", "A01", null],
      ["r2", "A02", null],
      ["r3", "B1", null],
      ["r4", "B1", null],
      [resident, "B1", own],
    ]);
  });
});

function createGroupDraft(code: string): GroupDraft {
  return { code, name: code, address: null, notes: null };
}

function createUnitDraft(
  code: string,
  restriction: Restriction | null = null,
): UnitDraft {
  return {
    code,
    name: null,
    floor: null,
    interior: null,
    subUnit: null,
    restriction,
    type: "apartment",
    cadastralData: null,
    notes: null,
  };
}

function createResidencyDraft(
  contactId: string,
  ownRestriction: Restriction | null = null,
): ResidencyDraft {
  return {
    contactId,
    role: "PR",
    startingBalance: cents(0),
    ownRestriction,
  };
}

/** The id an accepted add answers; throws with the reason of a refused one. */
function must(result: ResultOf<Added>): string {
  if (!result.ok) {
    throw new Error(`refused: ${result.reason}`);
  }

  return result.value.id;
}
