import type { Db } from "../db.ts";

/** The name master data gives a person (surname first) or a company. */
export function masterDataName(db: Db, masterDataId: string): string {
  const p = db.by("person", "masterDataId").get(masterDataId);

  if (p) {
    return [str(p.lastName), str(p.firstName)].filter(Boolean).join(" ");
  }

  const c = db.by("company", "masterDataId").get(masterDataId);
  return c ? String(c.name) : `Anagrafica ${masterDataId}`;
}

function str(v: unknown): string | undefined {
  return v === null || v === undefined || String(v).trim() === ""
    ? undefined
    : String(v).trim();
}
