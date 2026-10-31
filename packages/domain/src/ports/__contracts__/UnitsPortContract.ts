import { firstValueFrom, type Observable } from "rxjs";
import { describe, expect, it } from "vitest";

import { cents } from "#/entities/cents.ts";
import type { Restriction } from "#/entities/party.ts";
import type {
  GroupDraft,
  ResidencyDraft,
  UnitDraft,
} from "#/useCases/validateUnits.ts";

import type { UnitsPort } from "../unitsPort.ts";

/** What an adapter's test supplies so the contract can drive it. */
export interface UnitsPortHarness {
  port: UnitsPort;
  /** A period with units, groups and residents. */
  periodId: string;
  /** The period's first and last day. */
  periodStart: string;
  periodEnd: string;
  /** A day outside the period. */
  outsideDate: string;
  unknownPeriodId: string;
  /** A group of the period with no unit and no group in it. */
  emptyGroupId: string;
  /** A unit of the period whose resident namedResidentId a journal posting names. */
  unitId: string;
  namedResidentId: string;
  /** A resident of the period no posting names, with an installment item. */
  billedResidentId: string;
  /** A contact who lives in no unit of the period, and its name. */
  contactId: string;
  contactName: string;
  teardown: () => void;
}

export function describeUnitsPortContract(
  label: string,
  createHarness: () => UnitsPortHarness,
): void {
  describe(`${label} :: UnitsPort contract`, () => {
    it("answers a period's units, all of that period", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const units = await firstValueFrom(port.units(periodId));

        expect(units.length).toBeGreaterThan(0);
        expect(
          units.every((unit) => {
            return unit.periodId === periodId;
          }),
        ).toBe(true);
      } finally {
        teardown();
      }
    });

    it("answers a period's groups, all of that period, each unit's group among them", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const groups = await firstValueFrom(port.groups(periodId));
        const ids = new Set(
          groups.map((group) => {
            return group.id;
          }),
        );
        const units = await firstValueFrom(port.units(periodId));

        expect(groups.length).toBeGreaterThan(0);
        expect(
          groups.every((group) => {
            return group.periodId === periodId;
          }),
        ).toBe(true);
        expect(
          units.every((unit) => {
            return unit.groupId === null || ids.has(unit.groupId);
          }),
        ).toBe(true);
      } finally {
        teardown();
      }
    });

    it("answers a period's residents, each of a unit of that period, named with its unit's code", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const residents = await firstValueFrom(port.residents(periodId));
        const units = await firstValueFrom(port.units(periodId));

        expect(residents.length).toBeGreaterThan(0);
        expect(
          residents.every((resident) => {
            return units.some((unit) => {
              return (
                unit.id === resident.unitId && unit.code === resident.unitCode
              );
            });
          }),
        ).toBe(true);
      } finally {
        teardown();
      }
    });

    it("fails, naming the id, for a period it does not have", async () => {
      const { port, unknownPeriodId, teardown } = createHarness();
      const missing = `missing: the period ${unknownPeriodId}`;

      try {
        await expect(
          firstValueFrom(port.units(unknownPeriodId)),
        ).rejects.toThrow(missing);
        await expect(
          firstValueFrom(port.groups(unknownPeriodId)),
        ).rejects.toThrow(missing);
        await expect(
          firstValueFrom(port.residents(unknownPeriodId)),
        ).rejects.toThrow(missing);
        await expect(
          port.addGroup(unknownPeriodId, null, createGroupDraft("G9", "Nine")),
        ).rejects.toThrow(missing);
        await expect(
          port.addUnit(unknownPeriodId, null, createUnitDraft("Z1")),
        ).rejects.toThrow(missing);
      } finally {
        teardown();
      }
    });

    it("adds a group at the top and in a group, trimmed, emitting the groups once more each", async () => {
      const { port, periodId, emptyGroupId, teardown } = createHarness();
      const groups = watch(port.groups(periodId));

      try {
        const top = await port.addGroup(periodId, null, {
          code: " G9 ",
          name: " Nine ",
          address: { street: "Via Nove, 9", postcode: null, city: null },
          notes: "n",
        });

        const inner = await port.addGroup(
          periodId,
          emptyGroupId,
          createGroupDraft("G9", "Nine"),
        );
        const topId = top.ok ? top.value.id : "";
        const innerId = inner.ok ? inner.value.id : "";

        expect(groups.values).toHaveLength(3);
        expect(topId).not.toBe(innerId);
        expect(
          (groups.values[2] ?? []).find((group) => {
            return group.id === topId;
          }),
        ).toEqual({
          id: topId,
          periodId,
          code: "G9",
          name: "Nine",
          parentId: null,
          address: { street: "Via Nove, 9", postcode: null, city: null },
          notes: "n",
        });
        expect(
          (groups.values[2] ?? []).find((group) => {
            return group.id === innerId;
          }),
        ).toMatchObject({ parentId: emptyGroupId, code: "G9" });
      } finally {
        groups.stop();
        teardown();
      }
    });

    it("refuses a group with a blank code, a blank name, or a sibling's code or name, emitting nothing", async () => {
      const { port, periodId, teardown } = createHarness();
      const groups = watch(port.groups(periodId));

      try {
        const sibling = (groups.values[0] ?? []).find((group) => {
          return group.parentId === null;
        });
        const code = sibling?.code ?? "";
        const name = sibling?.name ?? "";

        expect(
          await port.addGroup(periodId, null, createGroupDraft(" ", "Nine")),
        ).toEqual({ ok: false, reason: "blank-code" });
        expect(
          await port.addGroup(periodId, null, createGroupDraft("G9", " ")),
        ).toEqual({ ok: false, reason: "blank-name" });
        expect(
          await port.addGroup(periodId, null, createGroupDraft(code, "Nine")),
        ).toEqual({ ok: false, reason: "group-taken", detail: code });
        expect(
          await port.addGroup(periodId, null, createGroupDraft("G9", name)),
        ).toEqual({ ok: false, reason: "group-taken", detail: name });
        expect(groups.values).toHaveLength(1);
      } finally {
        groups.stop();
        teardown();
      }
    });

    it("edits a group, emitting the groups once more, and refuses what validateGroup refuses", async () => {
      const { port, periodId, emptyGroupId, teardown } = createHarness();
      const groups = watch(port.groups(periodId));

      try {
        expect(
          await port.editGroup(emptyGroupId, createGroupDraft("E1", "Edited")),
        ).toEqual({ ok: true });
        expect(groups.values).toHaveLength(2);
        expect(
          (groups.values[1] ?? []).find((group) => {
            return group.id === emptyGroupId;
          }),
        ).toMatchObject({ code: "E1", name: "Edited", notes: "n" });
        expect(
          await port.editGroup(emptyGroupId, createGroupDraft("", "Edited")),
        ).toEqual({ ok: false, reason: "blank-code" });
        expect(groups.values).toHaveLength(2);
      } finally {
        groups.stop();
        teardown();
      }
    });

    it("deletes an empty group, emitting the groups once more, and refuses one a unit is in", async () => {
      const { port, periodId, emptyGroupId, teardown } = createHarness();
      const groups = watch(port.groups(periodId));

      try {
        const held = (await firstValueFrom(port.units(periodId))).find(
          (unit) => {
            return unit.groupId !== null;
          },
        );

        expect(await port.deleteGroup(held?.groupId ?? "")).toEqual({
          ok: false,
          reason: "group-not-empty",
        });
        expect(groups.values).toHaveLength(1);
        expect(await port.deleteGroup(emptyGroupId)).toEqual({ ok: true });
        expect(groups.values).toHaveLength(2);
        expect(
          (groups.values[1] ?? []).some((group) => {
            return group.id === emptyGroupId;
          }),
        ).toBe(false);
      } finally {
        groups.stop();
        teardown();
      }
    });

    it("adds a unit at the top and in a group, its code trimmed, emitting the units once more each", async () => {
      const { port, periodId, emptyGroupId, periodStart, teardown } =
        createHarness();
      const units = watch(port.units(periodId));
      const restriction = { from: periodStart, to: null };

      try {
        const top = await port.addUnit(periodId, null, {
          ...createUnitDraft(" Z1 ", restriction),
          name: "Attic",
          floor: "5",
          interior: "9",
          subUnit: "b",
          type: "garage",
          cadastralData: "Fg. 1",
        });

        const inner = await port.addUnit(
          periodId,
          emptyGroupId,
          createUnitDraft("Z2"),
        );
        const topId = top.ok ? top.value.id : "";
        const innerId = inner.ok ? inner.value.id : "";

        expect(units.values).toHaveLength(3);
        expect(
          (units.values[2] ?? []).find((unit) => {
            return unit.id === topId;
          }),
        ).toEqual({
          id: topId,
          periodId,
          code: "Z1",
          groupId: null,
          restriction,
          name: "Attic",
          floor: "5",
          interior: "9",
          subUnit: "b",
          type: "garage",
          cadastralData: "Fg. 1",
          notes: "n",
        });
        expect(
          (units.values[2] ?? []).find((unit) => {
            return unit.id === innerId;
          }),
        ).toMatchObject({ groupId: emptyGroupId, code: "Z2" });
      } finally {
        units.stop();
        teardown();
      }
    });

    it("refuses a unit with a blank code, another unit's code, an end before its start or dates outside the period, emitting nothing", async () => {
      const {
        port,
        periodId,
        unitId,
        periodStart,
        periodEnd,
        outsideDate,
        teardown,
      } = createHarness();
      const units = watch(port.units(periodId));

      try {
        const taken =
          (units.values[0] ?? []).find((unit) => {
            return unit.id !== unitId;
          })?.code ?? "";

        expect(
          await port.addUnit(periodId, null, createUnitDraft("  ")),
        ).toEqual({ ok: false, reason: "blank-code" });
        expect(
          await port.addUnit(periodId, null, createUnitDraft(taken)),
        ).toEqual({ ok: false, reason: "unit-code-taken", detail: taken });
        expect(await port.editUnit(unitId, createUnitDraft(taken))).toEqual({
          ok: false,
          reason: "unit-code-taken",
          detail: taken,
        });
        expect(
          await port.addUnit(
            periodId,
            null,
            createUnitDraft("Z1", { from: periodEnd, to: periodStart }),
          ),
        ).toEqual({ ok: false, reason: "bad-dates" });
        expect(
          await port.addUnit(
            periodId,
            null,
            createUnitDraft("Z1", { from: outsideDate, to: null }),
          ),
        ).toEqual({ ok: false, reason: "outside-period" });
        expect(units.values).toHaveLength(1);
      } finally {
        units.stop();
        teardown();
      }
    });

    it("edits a unit, emitting the units once more; its residents take its new code and, where they have none of their own, its dates", async () => {
      const { port, periodId, unitId, periodStart, teardown } = createHarness();
      const units = watch(port.units(periodId));
      const restriction = { from: periodStart, to: null };

      try {
        expect(
          await port.editUnit(unitId, createUnitDraft("Z9", restriction)),
        ).toEqual({ ok: true });
        expect(units.values).toHaveLength(2);
        expect(
          (units.values[1] ?? []).find((unit) => {
            return unit.id === unitId;
          }),
        ).toMatchObject({ code: "Z9", restriction, notes: "n" });

        const residents = (
          await firstValueFrom(port.residents(periodId))
        ).filter((resident) => {
          return resident.unitId === unitId;
        });

        expect(residents.length).toBeGreaterThan(0);
        expect(
          residents.every((resident) => {
            return (
              resident.unitCode === "Z9" &&
              JSON.stringify(resident.restriction) ===
                JSON.stringify(resident.ownRestriction ?? restriction)
            );
          }),
        ).toBe(true);
      } finally {
        units.stop();
        teardown();
      }
    });

    it("deletes a unit with its residents, and refuses one whose resident the journal names, naming the resident", async () => {
      const { port, periodId, unitId, namedResidentId, contactId, teardown } =
        createHarness();

      try {
        const named = (await firstValueFrom(port.residents(periodId))).find(
          (resident) => {
            return resident.id === namedResidentId;
          },
        );

        expect(await port.deleteUnit(unitId)).toEqual({
          ok: false,
          reason: "named-in-journal",
          detail: named?.name,
        });

        const unit = await port.addUnit(periodId, null, createUnitDraft("Z1"));
        const newUnitId = unit.ok ? unit.value.id : "";

        await port.addResident(newUnitId, createResidencyDraft(contactId));

        const units = watch(port.units(periodId));
        const residents = watch(port.residents(periodId));

        expect(await port.deleteUnit(newUnitId)).toEqual({ ok: true });
        expect(units.values).toHaveLength(2);
        expect(residents.values).toHaveLength(2);
        expect(
          (units.values[1] ?? []).some((candidate) => {
            return candidate.id === newUnitId;
          }),
        ).toBe(false);
        expect(
          (residents.values[1] ?? []).some((resident) => {
            return resident.unitId === newUnitId;
          }),
        ).toBe(false);
        units.stop();
        residents.stop();
      } finally {
        teardown();
      }
    });

    it("adds a resident named after its contact, for its unit's code and dates, with no share, emitting the residents once more", async () => {
      const {
        port,
        periodId,
        unitId,
        contactId,
        contactName,
        periodStart,
        periodEnd,
        teardown,
      } = createHarness();
      const residents = watch(port.residents(periodId));

      try {
        const unit = (await firstValueFrom(port.units(periodId))).find(
          (candidate) => {
            return candidate.id === unitId;
          },
        );

        const added = await port.addResident(unitId, {
          ...createResidencyDraft(contactId),
          role: "CO",
          startingBalance: cents(-1250),
        });
        const id = added.ok ? added.value.id : "";

        expect(residents.values).toHaveLength(2);
        expect(
          (residents.values[1] ?? []).find((resident) => {
            return resident.id === id;
          }),
        ).toEqual({
          kind: "owner",
          id,
          personId: contactId,
          name: contactName,
          unitCode: unit?.code,
          unitId,
          startingBalance: -1250,
          role: "CO",
          share: null,
          restriction: unit?.restriction ?? null,
          ownRestriction: null,
        });

        const own = { from: periodStart, to: periodEnd };
        const unitOnly = await port.addUnit(
          periodId,
          null,
          createUnitDraft("Z1"),
        );

        const dated = await port.addResident(
          unitOnly.ok ? unitOnly.value.id : "",
          createResidencyDraft(contactId, own),
        );

        expect(
          (await firstValueFrom(port.residents(periodId))).find((resident) => {
            return resident.id === (dated.ok ? dated.value.id : "");
          }),
        ).toMatchObject({ restriction: own, ownRestriction: own });
      } finally {
        residents.stop();
        teardown();
      }
    });

    it("refuses a resident with no contact, a contact already living in the unit, an end before its start or dates outside the period, emitting nothing", async () => {
      const {
        port,
        periodId,
        unitId,
        namedResidentId,
        contactId,
        periodStart,
        periodEnd,
        outsideDate,
        teardown,
      } = createHarness();
      const residents = watch(port.residents(periodId));

      try {
        const living =
          (residents.values[0] ?? []).find((resident) => {
            return resident.id === namedResidentId;
          })?.personId ?? "";

        expect(
          await port.addResident(unitId, {
            ...createResidencyDraft(contactId),
            contactId: null,
          }),
        ).toEqual({ ok: false, reason: "no-contact" });
        expect(
          await port.addResident(unitId, createResidencyDraft(living)),
        ).toEqual({ ok: false, reason: "already-resident", detail: living });
        expect(
          await port.addResident(
            unitId,
            createResidencyDraft(contactId, {
              from: periodEnd,
              to: periodStart,
            }),
          ),
        ).toEqual({ ok: false, reason: "bad-dates" });
        expect(
          await port.editResident(
            namedResidentId,
            createResidencyDraft(living, { from: null, to: outsideDate }),
          ),
        ).toEqual({ ok: false, reason: "outside-period" });
        expect(residents.values).toHaveLength(1);
      } finally {
        residents.stop();
        teardown();
      }
    });

    it("edits a resident, emitting the residents once more: a new contact renames it", async () => {
      const {
        port,
        periodId,
        namedResidentId,
        contactId,
        contactName,
        teardown,
      } = createHarness();
      const residents = watch(port.residents(periodId));

      try {
        expect(
          await port.editResident(namedResidentId, {
            ...createResidencyDraft(contactId),
            role: "SC",
            startingBalance: cents(700),
          }),
        ).toEqual({ ok: true });
        expect(residents.values).toHaveLength(2);
        expect(
          (residents.values[1] ?? []).find((resident) => {
            return resident.id === namedResidentId;
          }),
        ).toMatchObject({
          personId: contactId,
          name: contactName,
          role: "SC",
          startingBalance: 700,
          ownRestriction: null,
        });
      } finally {
        residents.stop();
        teardown();
      }
    });

    it("deletes a resident it added, and refuses one the journal names or one with installments, naming the resident", async () => {
      const {
        port,
        periodId,
        unitId,
        namedResidentId,
        billedResidentId,
        contactId,
        teardown,
      } = createHarness();
      const residents = watch(port.residents(periodId));

      try {
        function nameOf(id: string): string | undefined {
          return (residents.values[0] ?? []).find((resident) => {
            return resident.id === id;
          })?.name;
        }

        expect(await port.deleteResident(namedResidentId)).toEqual({
          ok: false,
          reason: "named-in-journal",
          detail: nameOf(namedResidentId),
        });
        expect(await port.deleteResident(billedResidentId)).toEqual({
          ok: false,
          reason: "has-installments",
          detail: nameOf(billedResidentId),
        });
        expect(residents.values).toHaveLength(1);

        const added = await port.addResident(
          unitId,
          createResidencyDraft(contactId),
        );
        const id = added.ok ? added.value.id : "";

        expect(await port.deleteResident(id)).toEqual({ ok: true });
        expect(residents.values).toHaveLength(3);
        expect(
          (residents.values[2] ?? []).some((resident) => {
            return resident.id === id;
          }),
        ).toBe(false);
      } finally {
        residents.stop();
        teardown();
      }
    });

    it("rejects, naming the id, for a group, a unit, a resident or a contact it does not have", async () => {
      const { port, periodId, unitId, namedResidentId, teardown } =
        createHarness();
      const group = createGroupDraft("G9", "Nine");
      const unit = createUnitDraft("Z1");
      const residency = createResidencyDraft("md-none");

      try {
        await expect(port.addGroup(periodId, "ug-none", group)).rejects.toThrow(
          "missing: the group ug-none",
        );
        await expect(port.editGroup("ug-none", group)).rejects.toThrow(
          "missing: the group ug-none",
        );
        await expect(port.deleteGroup("ug-none")).rejects.toThrow(
          "missing: the group ug-none",
        );
        await expect(port.addUnit(periodId, "ug-none", unit)).rejects.toThrow(
          "missing: the group ug-none",
        );
        await expect(port.editUnit("u-none", unit)).rejects.toThrow(
          "missing: the unit u-none",
        );
        await expect(port.deleteUnit("u-none")).rejects.toThrow(
          "missing: the unit u-none",
        );
        await expect(port.addResident("u-none", residency)).rejects.toThrow(
          "missing: the unit u-none",
        );
        await expect(port.addResident(unitId, residency)).rejects.toThrow(
          "missing: the contact md-none",
        );
        await expect(
          port.editResident(namedResidentId, residency),
        ).rejects.toThrow("missing: the contact md-none");
        await expect(port.editResident("r-none", residency)).rejects.toThrow(
          "missing: the resident r-none",
        );
        await expect(port.deleteResident("r-none")).rejects.toThrow(
          "missing: the resident r-none",
        );
      } finally {
        teardown();
      }
    });
  });
}

/** What a subscription has been told so far: the current value, then each re-emission. */
interface Watch<T> {
  values: T[];
  stop: () => void;
}

function watch<T>(source: Observable<T>): Watch<T> {
  const values: T[] = [];
  const subscription = source.subscribe((value) => {
    values.push(value);
  });

  return {
    values,
    stop: (): void => {
      subscription.unsubscribe();
    },
  };
}

function createGroupDraft(code: string, name: string): GroupDraft {
  return { code, name, address: null, notes: "n" };
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
    notes: "n",
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
