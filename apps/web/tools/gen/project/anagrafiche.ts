import type { Anagrafica } from "@cl/application";
import type { Db } from "../db.ts";
import { parseAddressVO, formatAddress } from "../addressVO.ts";

const str = (v: unknown): string | undefined => {
  if (v === null || v === undefined) return undefined;
  const t = String(v).trim();
  return t === "" ? undefined : t;
};

/** Category display name: prefer it-IT i18n translation, else the base name. */
function categoryName(db: Db, categoryId: string | null): string | undefined {
  if (!categoryId) return undefined;
  const base = db.by("masterDataCategory", "id").get(categoryId);
  if (!base) return undefined;
  const i18n = (db.group("masterDataCategoryI18n", "masterDataCategoryId").get(categoryId) ?? [])
    .find((r) => String(r.localeCode).startsWith("it"));
  return str(i18n?.translation) ?? str(base.name);
}

export function projectCategories(db: Db): string[] {
  const names = new Set<string>();
  for (const cat of db.rows("masterDataCategory")) {
    const n = categoryName(db, String(cat.id));
    if (n) names.add(n);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));
}

export function projectAnagrafiche(db: Db): Anagrafica[] {
  const persons = db.by("person", "masterDataId");
  const companies = db.by("company", "masterDataId");
  const out: Anagrafica[] = [];

  for (const md of db.rows("masterData")) {
    const id = String(md.id);
    const categoria = categoryName(db, str(md.masterDataCategoryId) ?? null);
    if (!categoria) continue; // master-data with no category isn't shown in the registry
    const stato: "active" | "archived" = String(md.status) === "archived" ? "archived" : "active";
    const codice = str(md.code);
    const codiceFiscale = str(md.taxCode);
    const partitaIva = str(md.vatNumber);
    const indirizzo = str(formatAddress(parseAddressVO(str(md.postalAddress) ?? null)));
    const note = str(md.notes);

    const company = companies.get(id);
    const person = persons.get(id);

    if (company) {
      const a: Anagrafica = {
        id: `md${id}`,
        kind: "company",
        nominativo: String(company.name),
        categoria,
        stato,
        ...(codice !== undefined && { codice }),
        ...(indirizzo !== undefined && { indirizzo }),
        ...(codiceFiscale !== undefined && { codiceFiscale }),
        ...(partitaIva !== undefined && { partitaIva }),
        ...(note !== undefined && { note }),
      };
      out.push(a);
    } else if (person) {
      const nome = str(person.firstName);
      const cognome = str(person.lastName);
      const sexRaw = str(person.sex)?.toLowerCase();
      const sesso: "m" | "f" | undefined =
        sexRaw === "m" || sexRaw === "f" ? sexRaw : undefined;
      const dataNascita = str(person.birthDate);
      const luogoNascita = str(person.birthPlace);
      const professione = str(person.occupation);
      const a: Anagrafica = {
        id: `md${id}`,
        kind: "person",
        nominativo:
          [cognome, nome].filter(Boolean).join(" ") ||
          (codice ?? `Anagrafica ${id}`),
        categoria,
        stato,
        ...(codice !== undefined && { codice }),
        ...(indirizzo !== undefined && { indirizzo }),
        ...(codiceFiscale !== undefined && { codiceFiscale }),
        ...(partitaIva !== undefined && { partitaIva }),
        ...(nome !== undefined && { nome }),
        ...(cognome !== undefined && { cognome }),
        ...(sesso !== undefined && { sesso }),
        ...(dataNascita !== undefined && { dataNascita }),
        ...(luogoNascita !== undefined && { luogoNascita }),
        ...(professione !== undefined && { professione }),
        ...(note !== undefined && { note }),
      };
      out.push(a);
    }
    // master-data that is neither person nor company (rare) is skipped.
  }

  return out.sort((a, b) =>
    a.nominativo.localeCompare(b.nominativo, "it", { sensitivity: "base" }),
  );
}
