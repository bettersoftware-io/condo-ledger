import {
  type Address,
  type Building,
  type BuildingType,
  type RecordStatus,
  romeTime,
} from "@cl/domain";

import type {
  AccountingPeriodNode,
  AccountingPeriodType,
  CondominiumNode,
} from "#/seedTypes.ts";

import { parseAddressVO } from "../addressVO.ts";
import type { Db } from "../db.ts";
import { streetOf } from "../pseudonymise/pseudonymise.ts";

/** The dump's condominium.type, in the domain's words. */
const BUILDING_TYPES: Record<string, BuildingType> = {
  regular: "building",
  super: "superBuilding",
  residence: "residence",
};

/** The dump's status of a condominium or a master-data entry, in the domain's words. */
const RECORD_STATUSES: Record<string, RecordStatus> = {
  active: "active",
  archived: "archived",
};

/** What a building is besides its id, its name and its periods. */
type BuildingProfile = Omit<Building, "id" | "name" | "periods">;

/**
 * Map legacy DB accountingPeriod.type → TS AccountingPeriodType.
 * Real dump values: 'regular', 'extra', 'auxiliary'.
 * 'ordinary' and 'extraordinary' do not appear in real exports; those
 * branches are defensive dead-code kept for safety.
 */
function mapPeriodType(raw: string): AccountingPeriodType {
  switch (raw) {
    case "ordinary":
    case "regular":
      return "ordinary";
    case "extra":
    case "extraordinary":
      return "extra";
    case "auxiliary":
      return "auxiliary";
    default:
      return "ordinary";
  }
}

function periodLabel(name: string, rawType: string): string {
  const type = mapPeriodType(rawType);

  if (type === "extra") {
    return `${name} (Straordinario)`;
  }

  if (type === "auxiliary") {
    return `${name} (Ausiliario)`;
  }

  return `${name} (Ordinario)`;
}

function condType(raw: unknown): CondominiumNode["type"] {
  const t = String(raw);
  return t === "super" || t === "residence" ? t : "regular";
}

export function projectTree(db: Db): CondominiumNode[] {
  return db.condominiums.map((c) => {
    return {
      id: `c${c.id}`,
      code: str(c.code) ?? "",
      name: String(c.name),
      type: condType(c.type),
      periods: db.periodsOf(String(c.id)).map((p): AccountingPeriodNode => {
        return {
          id: `p${p.id}`,
          name: periodLabel(String(p.name), String(p.type)),
          type: mapPeriodType(String(p.type)),
          closed: String(p.status) === "closed",
          start: str(p.startDate) ?? "",
          end: str(p.endDate) ?? "",
        };
      }),
    };
  });
}

/** A seeded building's profile, from its condominium row. */
export function buildingProfileOf(
  db: Db,
  condominiumId: string,
): BuildingProfile {
  const row = db.by("condominium", "id").get(condominiumId);
  const what = `the building ${condominiumId}`;

  return {
    code: str(row?.code) ?? null,
    type: known(BUILDING_TYPES, row?.type, `${what} has the type`),
    status: recordStatusOf(row?.status, `${what} has the status`),
    address: addressOf(db, row?.address),
    taxCode: str(row?.taxCode) ?? null,
    constructionDate: str(row?.manufacturedDate)?.slice(0, 10) ?? null,
    cadastralData: str(row?.landRegistry) ?? null,
    notes: str(row?.notes) ?? null,
    createdOn: romeStamp(row?.created, `the creation time of ${what}`),
    modifiedOn: romeStamp(row?.lastModified, `the last change of ${what}`),
  };
}

/**
 * A serialised AddressVO as an address: the street (or the street name and
 * number), the postcode, and the city by name or, failing that, through the
 * dump's city table. None when the blob has no street.
 */
export function addressOf(db: Db, blob: unknown): Address | null {
  const fields = parseAddressVO(str(blob) ?? null);
  const street = streetOf(fields);
  const cityId = fields.cityId;

  if (street === "") {
    return null;
  }

  return {
    street,
    postcode: str(fields.postCode) ?? null,
    city:
      str(fields.cityName) ??
      (cityId === undefined
        ? undefined
        : str(db.by("city", "id").get(cityId)?.name)) ??
      null,
  };
}

/** A building's or a contact's status; `what` says whose ("the contact 80 has the status"). */
export function recordStatusOf(value: unknown, what: string): RecordStatus {
  return known(RECORD_STATUSES, value, what);
}

/** A dump timestamp (UTC, "YYYY-MM-DD HH:mm:ss") in Rome time, written the same way. */
function romeStamp(value: unknown, what: string): string {
  const stamp = str(value);

  if (stamp === undefined) {
    throw new Error(`missing: ${what}`);
  }

  return romeTime(new Date(`${stamp.replace(" ", "T")}Z`)).replace("T", " ");
}

/** The domain's word for a dump value, refusing one it does not know. */
function known<T>(values: Record<string, T>, value: unknown, what: string): T {
  const key = String(value);

  if (!Object.hasOwn(values, key)) {
    throw new Error(`${what} ${key}, which the domain does not know`);
  }

  return values[key] as T;
}

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) {
    return undefined;
  }

  const t = String(v).trim();
  return t === "" ? undefined : t;
}
