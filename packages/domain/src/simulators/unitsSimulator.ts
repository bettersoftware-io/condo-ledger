import { BehaviorSubject, type Observable } from "rxjs";

import type { Contact } from "#/entities/contact.ts";
import type { InstallmentItem } from "#/entities/installment.ts";
import type { JournalEntry } from "#/entities/journal.ts";
import type { OwnerParty } from "#/entities/party.ts";
import { accepted, type Result, type ResultOf } from "#/entities/result.ts";
import type { Unit, UnitGroup } from "#/entities/unit.ts";
import type { Added, UnitsPort } from "#/ports/unitsPort.ts";
import { must } from "#/support/must.ts";
import type { PeriodDates } from "#/useCases/schedule.ts";
import {
  type GroupDraft,
  type ResidencyDraft,
  type UnitDraft,
  validateGroup,
  validateGroupDelete,
  validateResidency,
  validateResidencyDelete,
  validateUnit,
  validateUnitDelete,
} from "#/useCases/validateUnits.ts";

import { seededSchedule } from "./installmentsSimulator.ts";
import { missingPeriod } from "./missingPeriod.ts";
import type { LegacySeed } from "./seed/legacySeed.ts";
import { seededResidents } from "./seededParties.ts";

/** The port, and what the other simulators read of it: a period's units and residents as they stand now. */
export interface UnitsSimulator extends UnitsPort {
  /** Throws "missing: the period <id>" for a period the simulator does not have. */
  currentUnits(periodId: string): Unit[];
  /** Throws as currentUnits() does. */
  currentResidents(periodId: string): OwnerParty[];
}

/** What a write is judged against, read when it asks: the period's journal and items, the contacts, the period's dates. */
export interface UnitsReaders {
  entriesOf(periodId: string): JournalEntry[];
  itemsOf(periodId: string): InstallmentItem[];
  contactsOf(): Contact[];
  periodOf(periodId: string): PeriodDates;
}

/** A period's units, groups and residents, kept in memory. */
interface PeriodUnits {
  periodId: string;
  units$: BehaviorSubject<Unit[]>;
  groups$: BehaviorSubject<UnitGroup[]>;
  residents$: BehaviorSubject<OwnerParty[]>;
}

/**
 * The seed's units, groups and residents, a period at a time, with what is
 * written kept in memory: the one source the other simulators read them
 * from. A write is judged against the journal, the items, the contacts and
 * the period's dates as the readers answer them now; each left out, the
 * seed's. New
 * groups are `ug-new-<n>`, units `u-new-<n>` and residents `r-new-<n>`.
 * Throws on an unknown id: it never answers empty for a wrong key.
 */
export function createUnitsSimulator(
  seed: LegacySeed,
  wired: Partial<UnitsReaders> = {},
): UnitsSimulator {
  const readers: UnitsReaders = { ...seededReaders(seed), ...wired };
  const periods = new Map<string, PeriodUnits>();
  let groupsAdded = 0;
  let unitsAdded = 0;
  let residentsAdded = 0;

  for (const building of seed.buildings) {
    for (const period of building.periods) {
      periods.set(period.id, {
        periodId: period.id,
        units$: new BehaviorSubject(
          seed.units.filter((unit) => {
            return unit.periodId === period.id;
          }),
        ),
        groups$: new BehaviorSubject(
          seed.unitGroups.filter((group) => {
            return group.periodId === period.id;
          }),
        ),
        residents$: new BehaviorSubject(seededResidents(seed, period.id)),
      });
    }
  }

  function stateOf(periodId: string): PeriodUnits {
    return must(periods.get(periodId), `the period ${periodId}`);
  }

  function holderOfGroup(groupId: string): PeriodUnits {
    for (const state of periods.values()) {
      if (
        state.groups$.getValue().some((group) => {
          return group.id === groupId;
        })
      ) {
        return state;
      }
    }

    throw new Error(`missing: the group ${groupId}`);
  }

  function holderOfUnit(unitId: string): PeriodUnits {
    for (const state of periods.values()) {
      if (
        state.units$.getValue().some((unit) => {
          return unit.id === unitId;
        })
      ) {
        return state;
      }
    }

    throw new Error(`missing: the unit ${unitId}`);
  }

  function holderOfResident(residentId: string): PeriodUnits {
    for (const state of periods.values()) {
      if (
        state.residents$.getValue().some((resident) => {
          return resident.id === residentId;
        })
      ) {
        return state;
      }
    }

    throw new Error(`missing: the resident ${residentId}`);
  }

  /** The contact of a draft validateResidency accepted: it names one. */
  function contactOf(draft: ResidencyDraft): Contact {
    const contactId = must(draft.contactId, "the draft's contact");

    return must(
      readers.contactsOf().find((contact) => {
        return contact.id === contactId;
      }),
      `the contact ${contactId}`,
    );
  }

  function addGroup(
    state: PeriodUnits,
    parentId: string | null,
    draft: GroupDraft,
  ): ResultOf<Added> {
    const groups = state.groups$.getValue();

    if (parentId !== null) {
      groupIn(groups, parentId);
    }

    const verdict = validateGroup(draft, parentId, groups, null);

    if (!verdict.ok) {
      return verdict;
    }

    groupsAdded += 1;

    const id = `ug-new-${groupsAdded}`;

    state.groups$.next([
      ...groups,
      { id, periodId: state.periodId, parentId, ...groupFields(draft) },
    ]);

    return accepted({ id });
  }

  function editGroup(
    state: PeriodUnits,
    groupId: string,
    draft: GroupDraft,
  ): Result {
    const groups = state.groups$.getValue();
    const group = groupIn(groups, groupId);
    const verdict = validateGroup(draft, group.parentId, groups, groupId);

    if (verdict.ok) {
      state.groups$.next(
        groups.map((candidate) => {
          return candidate.id === groupId
            ? { ...candidate, ...groupFields(draft) }
            : candidate;
        }),
      );
    }

    return verdict;
  }

  function deleteGroup(state: PeriodUnits, groupId: string): Result {
    const groups = state.groups$.getValue();
    const verdict = validateGroupDelete(
      groupId,
      groups,
      state.units$.getValue(),
    );

    if (verdict.ok) {
      state.groups$.next(
        groups.filter((group) => {
          return group.id !== groupId;
        }),
      );
    }

    return verdict;
  }

  function addUnit(
    state: PeriodUnits,
    groupId: string | null,
    draft: UnitDraft,
  ): ResultOf<Added> {
    if (groupId !== null) {
      groupIn(state.groups$.getValue(), groupId);
    }

    const units = state.units$.getValue();
    const verdict = validateUnit(
      draft,
      units,
      readers.periodOf(state.periodId),
      null,
    );

    if (!verdict.ok) {
      return verdict;
    }

    unitsAdded += 1;

    const id = `u-new-${unitsAdded}`;

    state.units$.next([
      ...units,
      { id, periodId: state.periodId, groupId, ...unitFields(draft) },
    ]);

    return accepted({ id });
  }

  function editUnit(
    state: PeriodUnits,
    unitId: string,
    draft: UnitDraft,
  ): Result {
    const units = state.units$.getValue();
    const verdict = validateUnit(
      draft,
      units,
      readers.periodOf(state.periodId),
      unitId,
    );

    if (!verdict.ok) {
      return verdict;
    }

    const fields = unitFields(draft);

    state.units$.next(
      units.map((unit) => {
        return unit.id === unitId ? { ...unit, ...fields } : unit;
      }),
    );
    state.residents$.next(
      state.residents$.getValue().map((resident) => {
        return resident.unitId === unitId
          ? {
              ...resident,
              unitCode: fields.code,
              restriction: resident.ownRestriction ?? fields.restriction,
            }
          : resident;
      }),
    );

    return verdict;
  }

  function deleteUnit(state: PeriodUnits, unitId: string): Result {
    const residents = state.residents$.getValue();
    const verdict = validateUnitDelete(
      unitId,
      residents,
      readers.entriesOf(state.periodId),
      readers.itemsOf(state.periodId),
    );

    if (!verdict.ok) {
      return verdict;
    }

    // The residents go before their unit, so no reader sees a resident of a unit that is gone.
    state.residents$.next(
      residents.filter((resident) => {
        return resident.unitId !== unitId;
      }),
    );
    state.units$.next(
      state.units$.getValue().filter((unit) => {
        return unit.id !== unitId;
      }),
    );

    return verdict;
  }

  function addResident(
    state: PeriodUnits,
    unitId: string,
    draft: ResidencyDraft,
  ): ResultOf<Added> {
    const unit = unitIn(state.units$.getValue(), unitId);
    const residents = state.residents$.getValue();
    const verdict = validateResidency(
      draft,
      unitId,
      residents,
      readers.periodOf(state.periodId),
      null,
    );

    if (!verdict.ok) {
      return verdict;
    }

    const contact = contactOf(draft);

    residentsAdded += 1;

    const id = `r-new-${residentsAdded}`;

    state.residents$.next([
      ...residents,
      {
        kind: "owner",
        id,
        unitCode: unit.code,
        unitId,
        share: null,
        ...residencyFields(draft, contact, unit),
      },
    ]);

    return accepted({ id });
  }

  function editResident(
    state: PeriodUnits,
    residentId: string,
    draft: ResidencyDraft,
  ): Result {
    const residents = state.residents$.getValue();
    const resident = residentIn(residents, residentId);
    const unit = unitIn(state.units$.getValue(), resident.unitId);
    const verdict = validateResidency(
      draft,
      resident.unitId,
      residents,
      readers.periodOf(state.periodId),
      residentId,
    );

    if (!verdict.ok) {
      return verdict;
    }

    const contact = contactOf(draft);

    state.residents$.next(
      residents.map((candidate) => {
        return candidate.id === residentId
          ? { ...candidate, ...residencyFields(draft, contact, unit) }
          : candidate;
      }),
    );

    return verdict;
  }

  function deleteResident(state: PeriodUnits, residentId: string): Result {
    const residents = state.residents$.getValue();
    const verdict = validateResidencyDelete(
      residentIn(residents, residentId),
      readers.entriesOf(state.periodId),
      readers.itemsOf(state.periodId),
    );

    if (verdict.ok) {
      state.residents$.next(
        residents.filter((resident) => {
          return resident.id !== residentId;
        }),
      );
    }

    return verdict;
  }

  return {
    units: (periodId: string): Observable<Unit[]> => {
      const state = periods.get(periodId);

      return state === undefined
        ? missingPeriod(periodId)
        : state.units$.asObservable();
    },
    groups: (periodId: string): Observable<UnitGroup[]> => {
      const state = periods.get(periodId);

      return state === undefined
        ? missingPeriod(periodId)
        : state.groups$.asObservable();
    },
    residents: (periodId: string): Observable<OwnerParty[]> => {
      const state = periods.get(periodId);

      return state === undefined
        ? missingPeriod(periodId)
        : state.residents$.asObservable();
    },
    addGroup: (
      periodId: string,
      parentId: string | null,
      draft: GroupDraft,
    ): Promise<ResultOf<Added>> => {
      // A throw inside the executor is a rejection, as the port promises.
      return new Promise((resolve) => {
        resolve(addGroup(stateOf(periodId), parentId, draft));
      });
    },
    editGroup: (groupId: string, draft: GroupDraft): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(editGroup(holderOfGroup(groupId), groupId, draft));
      });
    },
    deleteGroup: (groupId: string): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(deleteGroup(holderOfGroup(groupId), groupId));
      });
    },
    addUnit: (
      periodId: string,
      groupId: string | null,
      draft: UnitDraft,
    ): Promise<ResultOf<Added>> => {
      return new Promise((resolve) => {
        resolve(addUnit(stateOf(periodId), groupId, draft));
      });
    },
    editUnit: (unitId: string, draft: UnitDraft): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(editUnit(holderOfUnit(unitId), unitId, draft));
      });
    },
    deleteUnit: (unitId: string): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(deleteUnit(holderOfUnit(unitId), unitId));
      });
    },
    addResident: (
      unitId: string,
      draft: ResidencyDraft,
    ): Promise<ResultOf<Added>> => {
      return new Promise((resolve) => {
        resolve(addResident(holderOfUnit(unitId), unitId, draft));
      });
    },
    editResident: (
      residentId: string,
      draft: ResidencyDraft,
    ): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(editResident(holderOfResident(residentId), residentId, draft));
      });
    },
    deleteResident: (residentId: string): Promise<Result> => {
      return new Promise((resolve) => {
        resolve(deleteResident(holderOfResident(residentId), residentId));
      });
    },
    currentUnits: (periodId: string): Unit[] => {
      return stateOf(periodId).units$.getValue();
    },
    currentResidents: (periodId: string): OwnerParty[] => {
      return stateOf(periodId).residents$.getValue();
    },
  };
}

/** The seed's journal, items, contacts and period dates: what the simulator judges against when nothing else is wired in. */
function seededReaders(seed: LegacySeed): UnitsReaders {
  return {
    entriesOf: (periodId: string): JournalEntry[] => {
      return seed.entries.filter((entry) => {
        return entry.periodId === periodId;
      });
    },
    itemsOf: (periodId: string): InstallmentItem[] => {
      return seededSchedule(seed, periodId).items;
    },
    contactsOf: (): Contact[] => {
      return seed.contacts;
    },
    periodOf: (periodId: string): PeriodDates => {
      const period = must(
        seed.buildings
          .flatMap((building) => {
            return building.periods;
          })
          .find((candidate) => {
            return candidate.id === periodId;
          }),
        `the period ${periodId}`,
      );

      return { start: period.start, end: period.end };
    },
  };
}

function groupIn(groups: UnitGroup[], groupId: string): UnitGroup {
  return must(
    groups.find((group) => {
      return group.id === groupId;
    }),
    `the group ${groupId}`,
  );
}

function unitIn(units: Unit[], unitId: string): Unit {
  return must(
    units.find((unit) => {
      return unit.id === unitId;
    }),
    `the unit ${unitId}`,
  );
}

function residentIn(residents: OwnerParty[], residentId: string): OwnerParty {
  return must(
    residents.find((resident) => {
      return resident.id === residentId;
    }),
    `the resident ${residentId}`,
  );
}

/** What a group draft writes: its code and name trimmed. */
function groupFields(
  draft: GroupDraft,
): Pick<UnitGroup, "code" | "name" | "address" | "notes"> {
  return {
    code: draft.code.trim(),
    name: draft.name.trim(),
    address: draft.address,
    notes: draft.notes,
  };
}

/** What a unit draft writes: its code trimmed. */
function unitFields(
  draft: UnitDraft,
): Omit<Unit, "id" | "periodId" | "groupId"> {
  return { ...draft, code: draft.code.trim() };
}

/** What a residency draft writes: the contact's id and name, its dates its own else its unit's. */
function residencyFields(
  draft: ResidencyDraft,
  contact: Contact,
  unit: Unit,
): Pick<
  OwnerParty,
  | "personId"
  | "name"
  | "startingBalance"
  | "role"
  | "restriction"
  | "ownRestriction"
> {
  return {
    personId: contact.id,
    name: contact.name,
    startingBalance: draft.startingBalance,
    role: draft.role,
    restriction: draft.ownRestriction ?? unit.restriction,
    ownRestriction: draft.ownRestriction,
  };
}
