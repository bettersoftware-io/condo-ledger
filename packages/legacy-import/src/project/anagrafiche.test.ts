import { describe, expect, it } from "vitest";

import { buildDb } from "../db.ts";
import type { Tables } from "../loadRows.ts";
import { projectAnagrafiche, projectCategories } from "./anagrafiche.ts";

const tables: Tables = {
  masterDataCategory: [
    { id: "5", name: "Impresa di pulizie", code: "PUL", order: "1" },
  ],
  masterDataCategoryI18n: [],
  masterData: [
    {
      id: "10",
      status: "active",
      code: "FCLEAN",
      taxCode: null,
      vatNumber: "14476590311",
      masterDataCategoryId: "5",
      postalAddress: `C:9:"AddressVO":1:{a:1:{s:8:"postCode";s:5:"33100";}}`,
      notes: null,
    },
    {
      id: "11",
      status: "archived",
      code: "MRO",
      taxCode: "RSSMRA80A01L483Z",
      vatNumber: null,
      masterDataCategoryId: "5",
      postalAddress: null,
      notes: "x",
    },
  ],
  company: [
    {
      masterDataId: "10",
      name: "Zanon Servizi di Pulizia s.n.c.",
      registeredOfficeAddress: null,
      taxPurposeAddress: null,
    },
  ],
  person: [
    {
      masterDataId: "11",
      firstName: "Tiziano",
      middleName: null,
      lastName: "Rossi",
      sex: "M",
      birthDate: "1980-01-01",
      birthPlace: "Udine",
      occupation: "Operaio",
      permanentAddress: null,
      officeAddress: null,
      currentAddress: null,
    },
  ],
};

describe("projectAnagrafiche", () => {
  it("maps a company", () => {
    const c = out.find((a) => {
      return a.id === "md10";
    })!;
    expect(c).toMatchObject({
      kind: "company",
      nominativo: "Zanon Servizi di Pulizia s.n.c.",
      categoria: "Impresa di pulizie",
      stato: "active",
      partitaIva: "14476590311",
      codice: "FCLEAN",
    });
    expect(c.indirizzo).toContain("33100");
  });
  it("maps a person with nominativo 'Cognome Nome' and lowercased sesso", () => {
    const p = out.find((a) => {
      return a.id === "md11";
    })!;
    expect(p).toMatchObject({
      kind: "person",
      nominativo: "Floreani Tiziano",
      cognome: "Rossi",
      nome: "Tiziano",
      sesso: "m",
      stato: "archived",
      codiceFiscale: "RSSMRA80A01L483Z",
      professione: "Operaio",
      luogoNascita: "Udine",
      dataNascita: "1980-01-01",
    });
  });
  it("category registry is the distinct category names", () => {
    expect(projectCategories(db)).toEqual(["Impresa di pulizie"]);
  });

  const db = buildDb(tables);

  const out = projectAnagrafiche(db);
});
