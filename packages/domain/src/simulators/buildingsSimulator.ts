import { BehaviorSubject, defer, map, type Observable } from "rxjs";

import type { Building, Period } from "#/entities/building.ts";
import { type Contact, nameOf, type SupplierLink } from "#/entities/contact.ts";
import type { OwnerParty } from "#/entities/party.ts";
import { ok, type Result } from "#/entities/result.ts";
import type { Unit } from "#/entities/unit.ts";
import type { BuildingsPort } from "#/ports/buildingsPort.ts";
import type { ClockPort } from "#/ports/clockPort.ts";
import { must } from "#/support/must.ts";
import { romeTime } from "#/support/romeTime.ts";
import {
  type BuildingDraft,
  type PeriodDraft,
  validateAddress,
  validateBuilding,
  validatePeriod,
  validateSupplier,
} from "#/useCases/validateBuilding.ts";

import type { LegacySeed } from "./seed/legacySeed.ts";
import { seededResidents } from "./seededParties.ts";

/** The port, and what the other simulators read of it: the buildings and the supplier links as they stand now. */
export interface BuildingsSimulator extends BuildingsPort {
  currentBuildings(): Building[];
  currentLinks(): SupplierLink[];
  /** Every building's links, and again whenever one changes. */
  links$: Observable<SupplierLink[]>;
}

/** What a write is judged against, read when it asks: the period's units and residents, and the contacts. Each left out, the seed's. */
export interface BuildingsReaders {
  unitsOf(periodId: string): Unit[];
  residentsOf(periodId: string): OwnerParty[];
  contactsOf(): Contact[];
}

/**
 * The seed's buildings and supplier links with what is edited kept in memory.
 * An accepted building edit is stamped `modifiedOn` from the clock, on the
 * Rome clock as the seed's are.
 */
export function createBuildingsSimulator(
  seed: LegacySeed,
  clock: ClockPort,
  wired: Partial<BuildingsReaders> = {},
): BuildingsSimulator {
  const readers: BuildingsReaders = { ...seededReaders(seed), ...wired };
  const buildings$ = new BehaviorSubject<Building[]>(seed.buildings);
  const links$ = new BehaviorSubject<SupplierLink[]>(seed.supplierLinks);

  function buildingOf(buildingId: string): Building {
    return must(
      buildings$.getValue().find((building) => {
        return building.id === buildingId;
      }),
      `the building ${buildingId}`,
    );
  }

  function holderOfPeriod(periodId: string): Building {
    return must(
      buildings$.getValue().find((building) => {
        return building.periods.some((period) => {
          return period.id === periodId;
        });
      }),
      `the period ${periodId}`,
    );
  }

  function replace(next: Building): void {
    buildings$.next(
      buildings$.getValue().map((building) => {
        return building.id === next.id ? next : building;
      }),
    );
  }

  /** The contact's name for a refusal: none when no contact is chosen. */
  function nameOfContact(contactId: string | null): string {
    if (contactId === null) {
      return "";
    }

    return nameOf(
      must(
        readers.contactsOf().find((contact) => {
          return contact.id === contactId;
        }),
        `the contact ${contactId}`,
      ),
    );
  }

  return {
    buildings: (): Observable<Building[]> => {
      return buildings$.asObservable();
    },
    currentBuildings: (): Building[] => {
      return buildings$.getValue();
    },
    currentLinks: (): SupplierLink[] => {
      return links$.getValue();
    },
    links$: links$.asObservable(),
    suppliers: (buildingId: string): Observable<string[]> => {
      return defer(() => {
        buildingOf(buildingId);

        return links$.pipe(
          map((links) => {
            return links
              .filter((link) => {
                return link.buildingId === buildingId;
              })
              .map((link) => {
                return link.contactId;
              });
          }),
        );
      });
    },
    addSupplier: (
      buildingId: string,
      contactId: string | null,
    ): Promise<Result> => {
      return Promise.resolve().then((): Result => {
        buildingOf(buildingId);

        const links = links$.getValue();
        const verdict = validateSupplier(
          buildingId,
          contactId,
          links,
          nameOfContact(contactId),
        );

        if (verdict.ok && contactId !== null) {
          links$.next([...links, { buildingId, contactId }]);
        }

        return verdict;
      });
    },
    removeSupplier: (
      buildingId: string,
      contactId: string,
    ): Promise<Result> => {
      return Promise.resolve().then((): Result => {
        buildingOf(buildingId);

        const links = links$.getValue();
        const held = must(
          links.find((link) => {
            return (
              link.buildingId === buildingId && link.contactId === contactId
            );
          }),
          `the supplier ${contactId} of ${buildingId}`,
        );

        links$.next(
          links.filter((link) => {
            return link !== held;
          }),
        );

        return ok();
      });
    },
    editBuilding: (
      buildingId: string,
      draft: BuildingDraft,
    ): Promise<Result> => {
      return Promise.resolve().then((): Result => {
        const building = buildingOf(buildingId);

        const verdict = judgedBuilding(
          draft,
          buildings$.getValue(),
          buildingId,
        );

        if (!verdict.ok) {
          return verdict;
        }

        replace({
          ...building,
          name: draft.name.trim(),
          code: blankToNull(draft.code),
          status: draft.status,
          type: draft.type,
          address: draft.address,
          taxCode: draft.taxCode,
          constructionDate: draft.constructionDate,
          cadastralData: draft.cadastralData,
          notes: draft.notes,
          modifiedOn: romeTime(clock.now()).replace("T", " "),
        });

        return verdict;
      });
    },
    editPeriod: (periodId: string, draft: PeriodDraft): Promise<Result> => {
      return Promise.resolve().then((): Result => {
        const building = holderOfPeriod(periodId);

        const verdict = validatePeriod(
          draft,
          building,
          periodId,
          readers.unitsOf(periodId),
          readers.residentsOf(periodId),
        );

        if (!verdict.ok) {
          return verdict;
        }

        replace({
          ...building,
          periods: building.periods.map((period) => {
            return period.id === periodId
              ? editedPeriod(period, draft)
              : period;
          }),
        });

        return verdict;
      });
    },
  };
}

function judgedBuilding(
  draft: BuildingDraft,
  buildings: Building[],
  editing: string,
): Result {
  const verdict = validateBuilding(draft, buildings, editing);

  if (!verdict.ok || draft.address === null) {
    return verdict;
  }

  return validateAddress(draft.address);
}

function editedPeriod(period: Period, draft: PeriodDraft): Period {
  return {
    ...period,
    name: draft.name.trim(),
    type: draft.type,
    closed: draft.closed,
    start: draft.start,
    end: draft.end,
    notes: draft.notes,
  };
}

function blankToNull(text: string | null): string | null {
  const trimmed = (text ?? "").trim();

  return trimmed === "" ? null : trimmed;
}

function seededReaders(seed: LegacySeed): BuildingsReaders {
  return {
    unitsOf: (periodId: string): Unit[] => {
      return seed.units.filter((unit) => {
        return unit.periodId === periodId;
      });
    },
    residentsOf: (periodId: string): OwnerParty[] => {
      return seededResidents(seed, periodId);
    },
    contactsOf: (): Contact[] => {
      return seed.contacts;
    },
  };
}
