import {
  type CompanyContact,
  type Contact,
  type ContactCategory,
  type ContactConnection,
  type ContactRow,
  type ContactRowType,
  nameOf,
  type PersonContact,
} from "@cl/domain";

import { parseAddressVO } from "../addressVO.ts";
import type { Db } from "../db.ts";
import type { Row } from "../loadRows.ts";
import { addressOf, recordStatusOf } from "./structure.ts";

/** The name master data gives a person (surname first) or a company. */
export function masterDataName(db: Db, masterDataId: string): string {
  const p = db.by("person", "masterDataId").get(masterDataId);

  if (p) {
    return [str(p.lastName), str(p.firstName)].filter(Boolean).join(" ");
  }

  const c = db.by("company", "masterDataId").get(masterDataId);
  return c ? String(c.name) : `Anagrafica ${masterDataId}`;
}

/** Every master-data entry as a contact, by name, then id: the archived and those no building uses included. */
export function projectContacts(db: Db): Contact[] {
  return db
    .rows("masterData")
    .map((row) => {
      return projectContact(db, String(row.id));
    })
    .sort((a, b) => {
      return (
        nameOf(a).localeCompare(nameOf(b), "it") || a.id.localeCompare(b.id)
      );
    });
}

/**
 * A master-data entry as a contact: a person or a company with its status,
 * code, category, tax code, VAT number, postal address, language, salutation
 * and notes, a person's gender, birth date and place and three addresses, a
 * company's registered office and tax domicile, and its contact rows by their
 * order (a variation's left out). The legacy permanent address is the
 * residence and the current address the domicile.
 */
function projectContact(db: Db, masterDataId: string): Contact {
  const row = db.by("masterData", "id").get(masterDataId);
  const person = db.by("person", "masterDataId").get(masterDataId);
  const company = db.by("company", "masterDataId").get(masterDataId);

  if (row === undefined) {
    throw new Error(`missing: the master data of the contact ${masterDataId}`);
  }

  const categoryId = str(row.masterDataCategoryId);
  const qualificationId = str(row.qualificationId);
  const common = {
    id: `md${masterDataId}`,
    status: recordStatusOf(
      row.status,
      `the contact ${masterDataId} has the status`,
    ),
    code: str(row.code) ?? null,
    categoryId: categoryId === undefined ? null : `mc${categoryId}`,
    salutation:
      qualificationId === undefined
        ? null
        : (str(db.by("qualification", "id").get(qualificationId)?.name) ??
          null),
    taxCode: str(row.taxCode) ?? null,
    vatNumber: str(row.vatNumber) ?? null,
    postalAddress: addressOf(db, row.postalAddress),
    language: languageOf(row.preferredLocaleCode),
    notes: str(row.notes) ?? null,
    rows: rowsOf(db, masterDataId),
  };

  if (person !== undefined) {
    return personContact(db, common, person);
  }

  if (company !== undefined) {
    return companyContact(db, common, company);
  }

  throw new Error(
    `the contact ${masterDataId} is neither a person nor a company`,
  );
}

/** The legacy categories, by id. */
export function projectContactCategories(db: Db): ContactCategory[] {
  return db
    .rows("masterDataCategory")
    .map((row) => {
      return { id: `mc${String(row.id)}`, name: String(row.name) };
    })
    .sort(byIdNumber);
}

/** The legacy cross relations: `to` is the contact one shows on, `from` the connected one. */
export function projectContactConnections(db: Db): ContactConnection[] {
  return db
    .rows("masterDataCrossRelation")
    .map((row) => {
      return {
        id: `cr${String(row.id)}`,
        contactId: `md${String(row.toMasterDataId)}`,
        connectedId: `md${String(row.fromMasterDataId)}`,
        relationship: String(row.relation),
        order: Number(row.order),
      };
    })
    .sort(byIdNumber);
}

/** The legacy salutations, the most used first, then by name. */
export function projectSalutations(db: Db): string[] {
  const uses = new Map<string, number>();

  for (const row of db.rows("masterData")) {
    const id = str(row.qualificationId);

    if (id !== undefined) {
      uses.set(id, (uses.get(id) ?? 0) + 1);
    }
  }

  return db
    .rows("qualification")
    .map((row) => {
      return { name: String(row.name), uses: uses.get(String(row.id)) ?? 0 };
    })
    .sort((a, b) => {
      return b.uses - a.uses || a.name.localeCompare(b.name, "it");
    })
    .map((salutation) => {
      return salutation.name;
    });
}

/** What a person and a company share, as projectContact reads it. */
type Common = Omit<
  CompanyContact,
  "kind" | "companyName" | "registeredOffice" | "taxDomicile"
>;

function personContact(db: Db, common: Common, person: Row): PersonContact {
  return {
    ...common,
    kind: "person",
    firstName: str(person.firstName) ?? null,
    lastName: str(person.lastName) ?? "",
    gender: genderOf(person.sex, common.id),
    birthDate: str(person.birthDate)?.slice(0, 10) ?? null,
    birthPlace: birthPlaceOf(db, person.birthPlace),
    officeAddress: addressOf(db, person.officeAddress),
    residenceAddress: addressOf(db, person.permanentAddress),
    domicileAddress: addressOf(db, person.currentAddress),
  };
}

function companyContact(db: Db, common: Common, firm: Row): CompanyContact {
  return {
    ...common,
    kind: "company",
    companyName: String(firm.name),
    registeredOffice: addressOf(db, firm.registeredOfficeAddress),
    taxDomicile: addressOf(db, firm.taxPurposeAddress),
  };
}

/** What has an id of the legacy form: a letter or two, then the number. */
interface Identified {
  id: string;
}

const ROW_TYPES: Readonly<Record<string, ContactRowType>> = {
  tel: "phone",
  mail: "email",
  web: "web",
  im: "im",
  pec: "pec",
};

/** The contact's own rows (a variation's left out) by their order, then id. */
function rowsOf(db: Db, masterDataId: string): ContactRow[] {
  return (db.group("masterDataContact", "masterDataId").get(masterDataId) ?? [])
    .filter((line) => {
      return str(line.masterDataVariationId) === undefined;
    })
    .map((line) => {
      const type = ROW_TYPES[String(line.type)];

      if (type === undefined) {
        throw new Error(
          `the contact row ${String(line.id)} has the type ${String(line.type)}, which the domain does not know`,
        );
      }

      return {
        id: `mr${String(line.id)}`,
        type,
        label: String(line.label),
        value: String(line.value),
        order: Number(line.order),
      };
    })
    .sort((a, b) => {
      return a.order - b.order || byIdNumber(a, b);
    });
}

function genderOf(sex: unknown, id: string): "m" | "f" | null {
  const value = str(sex);

  if (value === undefined) {
    return null;
  }

  if (value !== "m" && value !== "f") {
    throw new Error(
      `the contact ${id} has the sex ${value}, which the domain does not know`,
    );
  }

  return value;
}

/** The language of a legacy locale ("it_IT"): its first two letters when the app has them. */
function languageOf(locale: unknown): "it" | "en" | null {
  const language = str(locale)?.slice(0, 2).toLowerCase();

  return language === "it" || language === "en" ? language : null;
}

/** A birth place as the legacy app printed it: the city, then " - " and the country when it names one. Plain text. */
function birthPlaceOf(db: Db, blob: unknown): string | null {
  const fields = parseAddressVO(str(blob) ?? null);
  const city =
    str(fields.cityName) ??
    (fields.cityId === undefined
      ? undefined
      : str(db.by("city", "id").get(fields.cityId)?.name));

  const line = [city, str(fields.countryName)]
    .filter((part) => {
      return part !== undefined;
    })
    .join(" - ");

  return line === "" ? null : line;
}

function byIdNumber(a: Identified, b: Identified): number {
  return Number(a.id.replace(/\D/g, "")) - Number(b.id.replace(/\D/g, ""));
}

function str(v: unknown): string | undefined {
  return v === null || v === undefined || String(v).trim() === ""
    ? undefined
    : String(v).trim();
}
