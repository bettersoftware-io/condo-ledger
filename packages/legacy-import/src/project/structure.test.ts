import { describe, expect, it } from "vitest";

import { buildDb } from "../db.ts";
import type { Tables } from "../loadRows.ts";
import {
  projectDetails,
  projectF24,
  projectFunctional,
  projectTree,
} from "./structure.ts";

const tables: Tables = {
  condominium: [
    {
      id: "1",
      code: "SAT",
      name: "Saturno",
      status: "active",
      type: "regular",
      address: `C:9:"AddressVO":1:{a:1:{s:8:"postCode";s:5:"33100";s:6:"street";s:5:"via X";}}`,
      taxCode: "TC",
      vatNumber: null,
      parentCondominiumId: null,
      manufacturedDate: null,
      landRegistry: null,
      created: "2011-04-14 11:52:24",
      lastModified: "2012-12-18 14:41:01",
    },
  ],
  accountingPeriod: [
    {
      id: "1",
      condominiumId: "1",
      name: "2011",
      type: "ordinary",
      status: "opened",
      startDate: "2011-01-01",
      endDate: "2011-12-31",
      defaultCheckingAccountLedgerAccountId: "14",
      supplierAccountsPayableLedgerAccountId: "20",
      withholdingTaxPenaltyLedgerAccountId: "21",
      flatResidentAccountsReceivableLedgerAccountId: "22",
    },
  ],
  unit: [
    {
      id: "100",
      accountingPeriodId: "1",
      code: "A01",
      name: "x",
      unitTypeId: "1",
      unitGroupId: null,
      floor: "T",
      innerNumber: "1",
      subordinateNumber: null,
      periodRestrictionStartDate: null,
      periodRestrictionEndDate: null,
    },
  ],
  condominiumSupplier: [{ condominiumId: "1", masterDataId: "10", order: "1" }],
  masterData: [
    {
      id: "10",
      status: "active",
      code: "LUCENT",
      masterDataCategoryId: "5",
      vatNumber: "x",
      taxCode: null,
      postalAddress: null,
      notes: null,
    },
  ],
  masterDataCategory: [
    { id: "5", name: "Impresa di pulizie", code: "PUL", order: "1" },
  ],
  masterDataCategoryI18n: [],
  company: [{ masterDataId: "10", name: "Lucente Pulizie" }],
  person: [],
  f24: [
    {
      id: "1",
      condominiumId: "1",
      referenceDate: "2011-03-31",
      paymentDate: "2011-04-16",
      confirmed: true,
    },
  ],
};

describe("structure projection", () => {
  it("builds the tree with labelled periods", () => {
    expect(projectTree(db)).toEqual([
      {
        id: "c1",
        code: "SAT",
        name: "Saturno",
        type: "regular",
        periods: [
          {
            id: "p1",
            name: "2011 (Ordinario)",
            type: "ordinary",
            closed: false,
            start: "2011-01-01",
            end: "2011-12-31",
          },
        ],
      },
    ]);
  });
  it("builds detail with address + suppliers", () => {
    const d = projectDetails(db).p1!;
    expect(d).toMatchObject({
      intestazione: "Saturno",
      codice: "SAT",
      codiceFiscale: "TC",
      idSistema: "1",
    });
    expect(d.indirizzo).toContain("33100");
    expect(d.suppliers).toEqual([
      {
        id: "sup1-10",
        nominativo: "Lucente Pulizie",
        categoria: "Impresa di pulizie",
      },
    ]);
  });
  it("maps functional accounts from period columns", () => {
    expect(projectFunctional(db).p1).toEqual({
      liquid: "la14",
      payable: "la20",
      withholding: "la21",
      credit: "la22",
    });
  });
  it("maps f24 with stato from confirmed", () => {
    expect(projectF24(db).p1).toEqual([
      {
        id: "f24-1",
        descrizione: "Modello F24",
        scadenza: "2011-04-16",
        importo: { cents: 0 },
        stato: "pagato",
      },
    ]);
  });
  it("renders a null condominium code as empty (tree) / dash (detail), never the string 'null'", () => {
    // Real dump: Pozzetto (id 19) has code=NULL — must not surface as the literal "null".
    const nullCode = buildDb({
      condominium: [
        {
          id: "9",
          code: null,
          name: "Pozzetto",
          status: "active",
          type: "regular",
          address: null,
          taxCode: "TC9",
          vatNumber: null,
          parentCondominiumId: null,
          manufacturedDate: null,
          landRegistry: null,
          created: "",
          lastModified: "",
        },
      ],
      accountingPeriod: [
        {
          id: "5",
          condominiumId: "9",
          name: "2013",
          type: "ordinary",
          status: "opened",
          startDate: "2013-01-01",
          endDate: "2013-12-31",
        },
      ],
      unit: [
        {
          id: "200",
          accountingPeriodId: "5",
          code: "B01",
          name: "y",
          unitTypeId: "1",
          unitGroupId: null,
          floor: null,
          innerNumber: null,
          subordinateNumber: null,
          periodRestrictionStartDate: null,
          periodRestrictionEndDate: null,
        },
      ],
    });
    expect(projectTree(nullCode)[0]!.code).toBe("");
    expect(projectDetails(nullCode).p5!.codice).toBe("—");
  });
  it("renders a null period endDate as empty string, never 'null' (structure-only periods)", () => {
    // Real dump: e.g. Mercurio "Tinteggiatura esterna" has endDate=NULL — must not surface as "null".
    const nullEnd = buildDb({
      condominium: [
        {
          id: "9",
          code: "MER",
          name: "Mercurio",
          status: "active",
          type: "regular",
          address: null,
          taxCode: "TC9",
          vatNumber: null,
          parentCondominiumId: null,
          manufacturedDate: null,
          landRegistry: null,
          created: "",
          lastModified: "",
        },
      ],
      accountingPeriod: [
        {
          id: "5",
          condominiumId: "9",
          name: "Tinteggiatura esterna",
          type: "auxiliary",
          status: "closed",
          startDate: "2010-01-01",
          endDate: null,
        },
      ],
      unit: [
        {
          id: "200",
          accountingPeriodId: "5",
          code: "B01",
          name: "y",
          unitTypeId: "1",
          unitGroupId: null,
          floor: null,
          innerNumber: null,
          subordinateNumber: null,
          periodRestrictionStartDate: null,
          periodRestrictionEndDate: null,
        },
      ],
    });
    const period = projectTree(nullEnd)[0]!.periods[0]!;
    expect(period.end).toBe("");
    expect(period.start).toBe("2010-01-01");
  });

  const db = buildDb(tables);
});

const extraTables: Tables = {
  condominium: [
    {
      id: "10",
      code: "NET",
      name: "Nettuno",
      status: "active",
      type: "residence",
      address: null,
      taxCode: null,
      vatNumber: null,
      parentCondominiumId: null,
      manufacturedDate: null,
      landRegistry: null,
      created: "2010-01-01 00:00:00",
      lastModified: "2010-01-01 00:00:00",
    },
    {
      id: "13",
      code: "SOL",
      name: "Sole",
      status: "active",
      type: "super",
      address: null,
      taxCode: null,
      vatNumber: null,
      parentCondominiumId: null,
      manufacturedDate: null,
      landRegistry: null,
      created: "2010-01-01 00:00:00",
      lastModified: "2010-01-01 00:00:00",
    },
  ],
  accountingPeriod: [
    {
      id: "10",
      condominiumId: "10",
      name: "Spese riscaldamento 2010",
      type: "auxiliary",
      status: "closed",
      startDate: "2010-01-01",
      endDate: "2010-12-31",
      defaultCheckingAccountLedgerAccountId: null,
      supplierAccountsPayableLedgerAccountId: null,
      withholdingTaxPenaltyLedgerAccountId: null,
      flatResidentAccountsReceivableLedgerAccountId: null,
    },
    {
      id: "13",
      condominiumId: "13",
      name: "Straordinario 2010",
      type: "extra",
      status: "opened",
      startDate: "2010-01-01",
      endDate: "2010-12-31",
      defaultCheckingAccountLedgerAccountId: null,
      supplierAccountsPayableLedgerAccountId: null,
      withholdingTaxPenaltyLedgerAccountId: null,
      flatResidentAccountsReceivableLedgerAccountId: null,
    },
  ],
  unit: [
    {
      id: "200",
      accountingPeriodId: "10",
      code: "B01",
      name: "y",
      unitTypeId: "1",
      unitGroupId: null,
      floor: "T",
      innerNumber: "1",
      subordinateNumber: null,
      periodRestrictionStartDate: null,
      periodRestrictionEndDate: null,
    },
    {
      id: "201",
      accountingPeriodId: "13",
      code: "C01",
      name: "z",
      unitTypeId: "1",
      unitGroupId: null,
      floor: "T",
      innerNumber: "1",
      subordinateNumber: null,
      periodRestrictionStartDate: null,
      periodRestrictionEndDate: null,
    },
  ],
  condominiumSupplier: [],
  masterData: [],
  masterDataCategory: [],
  masterDataCategoryI18n: [],
  company: [],
  person: [],
  f24: [],
};

describe("structure projection — condominium type + period label regressions", () => {
  it("projects residence condominium type correctly (Nettuno id=10)", () => {
    const nettuno = tree.find((n) => {
      return n.code === "NET";
    })!;
    expect(nettuno.type).toBe("residence");
  });

  it("projects super condominium type correctly (Sole id=13)", () => {
    const sole = tree.find((n) => {
      return n.code === "SOL";
    })!;
    expect(sole.type).toBe("super");
  });

  it("maps auxiliary period type and labels it (Ausiliario)", () => {
    const nettuno = tree.find((n) => {
      return n.code === "NET";
    })!;
    const p = nettuno.periods[0]!;
    expect(p.type).toBe("auxiliary");
    expect(p.name).toMatch(/\(Ausiliario\)$/);
  });

  it("maps extra period type and labels it (Straordinario)", () => {
    const sole = tree.find((n) => {
      return n.code === "SOL";
    })!;
    const p = sole.periods[0]!;
    expect(p.type).toBe("extra");
    expect(p.name).toMatch(/\(Straordinario\)$/);
  });

  const db = buildDb(extraTables);

  const tree = projectTree(db);
});
