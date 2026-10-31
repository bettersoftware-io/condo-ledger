import type { Contact } from "@cl/domain";

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

/**
 * A master-data entry as a contact: a person or a company, its category, a
 * company's registered office and tax domicile, and its first phone and
 * first email (a variation's contact rows left out).
 */
export function projectContact(db: Db, masterDataId: string): Contact {
  const row = db.by("masterData", "id").get(masterDataId);
  const person = db.by("person", "masterDataId").get(masterDataId);
  const company = db.by("company", "masterDataId").get(masterDataId);

  if (row === undefined) {
    throw new Error(`missing: the master data of the contact ${masterDataId}`);
  }

  if (person === undefined && company === undefined) {
    throw new Error(
      `the contact ${masterDataId} is neither a person nor a company`,
    );
  }

  const lines = (
    db.group("masterDataContact", "masterDataId").get(masterDataId) ?? []
  )
    .filter((line) => {
      return str(line.masterDataVariationId) === undefined;
    })
    .sort((a, b) => {
      return Number(a.order) - Number(b.order);
    });
  const categoryId = str(row.masterDataCategoryId);
  const firm = person === undefined ? company : undefined;

  return {
    id: `md${masterDataId}`,
    kind: firm === undefined ? "person" : "company",
    name: masterDataName(db, masterDataId),
    status: recordStatusOf(
      row.status,
      `the contact ${masterDataId} has the status`,
    ),
    code: str(row.code) ?? null,
    category:
      categoryId === undefined
        ? null
        : (str(db.by("masterDataCategory", "id").get(categoryId)?.name) ??
          null),
    companyName: firm === undefined ? null : String(firm.name),
    registeredOffice:
      firm === undefined ? null : addressOf(db, firm.registeredOfficeAddress),
    taxDomicile:
      firm === undefined ? null : addressOf(db, firm.taxPurposeAddress),
    phone: firstOf(lines, "tel"),
    email: firstOf(lines, "mail"),
  };
}

/** The value of the first contact row of the type; null when there is none. */
function firstOf(lines: Row[], type: string): string | null {
  return (
    str(
      lines.find((line) => {
        return line.type === type;
      })?.value,
    ) ?? null
  );
}

function str(v: unknown): string | undefined {
  return v === null || v === undefined || String(v).trim() === ""
    ? undefined
    : String(v).trim();
}
