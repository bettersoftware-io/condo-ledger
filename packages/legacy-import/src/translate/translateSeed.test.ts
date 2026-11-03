import { describe, expect, it } from "vitest";

import type {
  AccountData,
  Building,
  Contact,
  ContactRow,
  Installment,
  InvoiceData,
  JournalEntryData,
  LegacySeedData,
  ManualDeadline,
  PersonContact,
  ThousandthTable,
  Unit,
  UnitGroup,
  WithholdingTaxData,
} from "@cl/domain";
import { createPersonContact } from "@cl/domain/testing/createContacts.ts";

import { translateLegacySeed } from "./translateSeed.ts";

describe("translateLegacySeed", () => {
  it("translates a string the exact map holds", () => {
    const seed = translateLegacySeed(
      createSeed({
        accounts: [
          createAccount({
            id: "la1",
            name: "Spese generali",
            abbreviation: "Generali PR",
          }),
        ],
      }),
    );

    expect(seed.accounts[0]?.name).toBe("General expenses");
    expect(seed.accounts[0]?.abbreviation).toBe("General PR");
  });

  it.each([
    [
      "Registrazione fattura Cargnelutti Elevatori s.n.c. n. 1358 del 01/12/2012: controllo ascensori",
      "Invoice Cargnelutti Elevatori s.n.c. no. 1358 of 01/12/2012: Elevator inspection",
    ],
    [
      "Registrazione fattura n. 43117 del 13/03/2013 (Energie del Ledra S.p.A. / bolletta acqua)",
      "Invoice no. 43117 of 13/03/2013 (Energie del Ledra S.p.A. / Water bill)",
    ],
    [
      "Pagamento fattura Natisone Gas S.p.A. n. 7736 effettuato il 13/02/2013: bolletta acqua",
      "Payment of invoice Natisone Gas S.p.A. no. 7736 on 13/02/2013: Water bill",
    ],
    [
      "Pagamento fattura Cragno Giardinaggio soc. coop. n. 42 del 23/04/2011: Riparazione porte",
      "Payment of invoice Cragno Giardinaggio soc. coop. no. 42 of 23/04/2011: Door repairs",
    ],
    [
      "Incasso Rate da Bearzi Servizi s.a.s.: Rata 1 (20/01/2013), Rata 2 (20/02/2013)",
      "Collection of installments from Bearzi Servizi s.a.s.: Installment 1 (20/01/2013), Installment 2 (20/02/2013)",
    ],
    [
      "Incasso Parziale Rate da Fornasier Marco: Rata 1 (20/01/2013)",
      "Partial collection of installments from Fornasier Marco: Installment 1 (20/01/2013)",
    ],
    [
      "Incasso Rate 2011 (Ordinario) / Minisini Ilaria",
      "Installment collection 2011 (Ordinary) / Minisini Ilaria",
    ],
    [
      "Incasso rate 2011 (Ordinario) n.1 del (Sarcinelli Albino)",
      "Installment collection 2011 (Ordinary) no. 1 (Sarcinelli Albino)",
    ],
  ])("translates the description %s by its pattern", (italian, english) => {
    const seed = translateLegacySeed(
      createSeed({ entries: [createEntry({ description: italian })] }),
    );

    expect(seed.entries[0]?.description).toBe(english);
  });

  it("names an installment as the app names a new one, by its number", () => {
    const seed = translateLegacySeed(
      createSeed({
        installments: [
          createInstallment({ id: "in1", name: "Rata nr. 1" }),
          createInstallment({ id: "in2", name: "Rata 12" }),
        ],
      }),
    );

    expect(
      seed.installments.map((installment) => {
        return installment.name;
      }),
    ).toEqual(["Installment 1", "Installment 12"]);
  });

  it("keeps the bank's name in a bank account and translates the rest", () => {
    const seed = translateLegacySeed(
      createSeed({
        accounts: [
          createAccount({
            id: "la1",
            name: "Credito Carnico - C/C 4990808838",
          }),
        ],
      }),
    );

    expect(seed.accounts[0]?.name).toBe("Credito Carnico - a/c 4990808838");
  });

  it("refuses a pattern whose captured reason the exact map does not hold", () => {
    expect(() => {
      return translateLegacySeed(
        createSeed({
          entries: [
            createEntry({
              id: "tx7",
              description:
                "Registrazione fattura Ditta s.r.l. n. 1 del 01/01/2013: lavori mai visti",
            }),
          ],
        }),
      );
    }).toThrow(/entries\.description of tx7.*lavori mai visti/);
  });

  it("refuses a string with no exact entry and no pattern, naming the field and the record", () => {
    expect(() => {
      return translateLegacySeed(
        createSeed({
          accounts: [createAccount({ id: "la9", name: "Conto mai visto" })],
        }),
      );
    }).toThrow(/accounts\.name of la9: "Conto mai visto"/);
  });

  it("translates every field it is given, and leaves ids, amounts and names alone", () => {
    const italian = createSeed({
      accounts: [createAccount({ id: "la1", name: "Liquidità", budget: 500 })],
      entries: [
        createEntry({ id: "tx1", description: "Inserimento saldi apertura" }),
      ],
      invoices: [createInvoice({ id: "li1", reason: "Revisione caldaia" })],
      installments: [createInstallment({ id: "in1", name: "Rata nr. 1" })],
      tables: [
        createTable({
          id: "dt1",
          name: "Proprietà",
          notes: "",
        }),
      ],
      unitGroups: [createUnitGroup({ id: "ug1", name: "Scala A" })],
      withholdingTaxes: [createWithholdingTax({ name: "Società di persone" })],
    });

    const english = translateLegacySeed(italian);

    expect(english).toEqual({
      ...italian,
      accounts: [{ ...italian.accounts[0], name: "Liquidity" }],
      entries: [
        { ...italian.entries[0], description: "Opening balances entry" },
      ],
      invoices: [{ ...italian.invoices[0], reason: "Boiler service" }],
      installments: [{ ...italian.installments[0], name: "Installment 1" }],
      tables: [{ ...italian.tables[0], name: "Property" }],
      unitGroups: [{ ...italian.unitGroups[0], name: "Stairwell A" }],
      withholdingTaxes: [
        { ...italian.withholdingTaxes[0], name: "Partnerships" },
      ],
    });
  });

  it("translates a deadline's description and notes, and keeps no notes as none", () => {
    const seed = translateLegacySeed(
      createSeed({
        deadlines: [
          createDeadline({
            id: "ce26",
            description: "Pulizie spazi comuni",
            notes: null,
          }),
          createDeadline({
            id: "ce24",
            description: "Chiusura per ferie",
            notes:
              "Il ns. studio resterà chiuso per ferie dal 13/2 al 26/8.nPer urgenze, chiamare il 347-43546518.",
          }),
        ],
      }),
    );

    expect(seed.deadlines).toEqual([
      expect.objectContaining({
        description: "Cleaning of shared spaces",
        notes: null,
      }),
      expect.objectContaining({
        description: "Closed for holidays",
        notes:
          "Our office will be closed for holidays from 13/2 to 26/8. For urgent matters, call 347-43546518.",
      }),
    ]);
  });

  it("refuses a deadline with no English, naming the field and the record", () => {
    expect(() => {
      return translateLegacySeed(
        createSeed({
          deadlines: [
            createDeadline({ id: "ce99", description: "Scadenza mai vista" }),
          ],
        }),
      );
    }).toThrow(/deadlines\.description of ce99: "Scadenza mai vista"/);
  });

  it("translates the notes of a building, a period, a unit and a group, and keeps an empty one empty", () => {
    const seed = translateLegacySeed(
      createSeed({
        buildings: [createBuilding("Impresa di pulizie", "Giardiniere")],
        units: [createUnit("notennotennote2")],
        unitGroups: [
          createUnitGroup({ id: "ug1", notes: "Ferramenta" }),
          createUnitGroup({ id: "ug2", name: "Box", notes: null }),
        ],
      }),
    );

    expect([
      seed.buildings[0]?.notes,
      seed.buildings[0]?.periods[0]?.notes,
      seed.units[0]?.notes,
      seed.unitGroups.map((group) => {
        return group.notes;
      }),
    ]).toEqual([
      "Cleaning company",
      "Gardener",
      "note note note2",
      ["Hardware store", null],
    ]);
  });

  it("translates a contact's salutation and row labels, the categories, the relationships and the salutations, leaving the test labels as data and a missing salutation missing", () => {
    const seed = translateLegacySeed(
      createSeed({
        contacts: [
          createContact({
            id: "md1",
            salutation: "Egregio Signore",
            rows: [
              createRow("mr1", "Telefono"),
              createRow("mr2", "Sito Web"),
              createRow("mr3", "sdfsd22"),
            ],
          }),
          createContact({ id: "md2", salutation: null }),
        ],
        contactCategories: [{ id: "mc29", name: "Condòmino" }],
        contactConnections: [
          {
            id: "cr1",
            contactId: "md1",
            connectedId: "md2",
            relationship: "Impiegato",
            order: 1,
          },
        ],
        salutations: ["Egregio Signore", "Spettabile"],
      }),
    );

    expect(seed.contacts[0]?.salutation).toBe("Dear Sir");
    expect(seed.contacts[1]?.salutation).toBeNull();
    expect(
      seed.contacts[0]?.rows.map((row) => {
        return row.label;
      }),
    ).toEqual(["Phone", "Website", "sdfsd22"]);
    expect(seed.contactCategories).toEqual([{ id: "mc29", name: "Owner" }]);
    expect(seed.contactConnections[0]?.relationship).toBe("Employee");
    expect(seed.salutations).toEqual(["Dear Sir", "Dear Sir or Madam"]);
  });

  it("translates a contact's note, keeps an empty one empty, and stops on an unknown one naming the record", () => {
    const seed = translateLegacySeed(
      createSeed({
        contacts: [
          createContact({ id: "md1", notes: "cvd" }),
          createContact({ id: "md2", notes: "" }),
          createContact({ id: "md3", notes: null }),
        ],
      }),
    );

    expect(
      seed.contacts.map((contact) => {
        return contact.notes;
      }),
    ).toEqual(["cvd", "", null]);
    expect(() => {
      return translateLegacySeed(
        createSeed({
          contacts: [createContact({ id: "md9", notes: "Chiamare lunedì" })],
        }),
      );
    }).toThrow(/contacts\.notes of md9.*Chiamare lunedì/);
  });

  it("stops on a row label it has no English for, naming the row", () => {
    expect(() => {
      return translateLegacySeed(
        createSeed({
          contacts: [
            createContact({ id: "md1", rows: [createRow("mr7", "Telex")] }),
          ],
        }),
      );
    }).toThrow(/mr7.*Telex/);
  });

  it("refuses two sibling accounts whose different Italian names would read the same in English", () => {
    expect(() => {
      return translateLegacySeed(
        createSeed({
          accounts: [
            createAccount({ id: "la1", name: "Cassa Contanti" }),
            createAccount({ id: "la2", name: "Cassa contanti" }),
          ],
        }),
      );
    }).toThrow(/la1 and la2.*Cash on hand/);
  });

  it("lets accounts under different parents share an English name", () => {
    const seed = translateLegacySeed(
      createSeed({
        accounts: [
          createAccount({ id: "la1", name: "Cassa Contanti", parentId: "la8" }),
          createAccount({ id: "la2", name: "Cassa contanti", parentId: "la9" }),
        ],
      }),
    );

    expect(
      seed.accounts.map((account) => {
        return account.name;
      }),
    ).toEqual(["Cash on hand", "Cash on hand"]);
  });
});

function createSeed(records: Partial<LegacySeedData>): LegacySeedData {
  return {
    buildings: [],
    accounts: [],
    entries: [],
    parties: [],
    invoices: [],
    withholdingTaxes: [],
    installments: [],
    installmentItems: [],
    units: [],
    unitGroups: [],
    tables: [],
    coefficients: [],
    contacts: [],
    contactCategories: [],
    contactConnections: [],
    salutations: [],
    supplierLinks: [],
    deadlines: [],
    ...records,
  };
}

function createDeadline(over: Partial<ManualDeadline>): ManualDeadline {
  return {
    id: "ce1",
    date: "2013-02-05",
    time: null,
    calendar: "general",
    buildingId: null,
    description: "Chiusura per ferie",
    status: "new",
    priority: "none",
    notes: null,
    ...over,
  };
}

function createBuilding(notes: string, periodNotes: string): Building {
  return {
    id: "c1",
    name: "Saturno",
    code: "SAT",
    type: "building",
    status: "active",
    address: null,
    taxCode: null,
    constructionDate: null,
    cadastralData: null,
    notes,
    createdOn: "2011-04-14 13:52:24",
    modifiedOn: "2012-12-18 15:41:01",
    periods: [
      {
        id: "p1",
        name: "2011",
        type: "ordinary",
        start: "2011-01-01",
        end: "2011-12-31",
        closed: false,
        notes: periodNotes,
      },
    ],
  };
}

function createUnit(notes: string): Unit {
  return {
    id: "u1",
    periodId: "p1",
    code: "A1",
    groupId: null,
    restriction: null,
    name: null,
    floor: null,
    interior: null,
    subUnit: null,
    type: "apartment",
    cadastralData: null,
    notes,
  };
}

function createContact(fields: Partial<PersonContact>): Contact {
  return createPersonContact("md1", "Rossi", "Anna", fields);
}

function createRow(id: string, label: string): ContactRow {
  return { id, type: "phone", label, value: "0432 111", order: 1 };
}

function createAccount(fields: Partial<AccountData>): AccountData {
  return {
    id: "la1",
    periodId: "p1",
    parentId: null,
    name: "Liquidità",
    order: 1,
    nature: "assets",
    type: "regular",
    role: null,
    budget: null,
    abbreviation: null,
    links: [],
    ...fields,
  };
}

function createEntry(fields: Partial<JournalEntryData>): JournalEntryData {
  return {
    id: "tx1",
    periodId: "p1",
    number: 1,
    at: "2013-01-10T15:59:29",
    kind: "generic",
    description: "",
    postings: [
      { accountId: "la1", debit: 1234, credit: 0, counterpart: null },
      {
        accountId: "la2",
        debit: 0,
        credit: 1234,
        counterpart: { kind: "owner", id: "r1" },
      },
    ],
    invoiceId: null,
    ...fields,
  };
}

function createInvoice(fields: Partial<InvoiceData>): InvoiceData {
  return {
    id: "li1",
    periodId: "p1",
    entryId: "tx1",
    supplierId: "md1",
    number: "74",
    reason: "",
    date: "2013-04-01",
    dueDate: null,
    costAccountId: "la1",
    taxable: 10000,
    socialSecurityRate: 400,
    vatRate: 2200,
    nonTaxable: 0,
    withholdingCode: null,
    withholdingOnSocialSecurity: false,
    ...fields,
  };
}

function createInstallment(fields: Partial<Installment>): Installment {
  return {
    id: "in1",
    periodId: "p1",
    number: 1,
    name: "Rata nr. 1",
    dueDate: "2013-01-20",
    locked: false,
    ...fields,
  };
}

function createTable(fields: Partial<ThousandthTable>): ThousandthTable {
  return {
    id: "dt1",
    periodId: "p1",
    name: "Proprietà",
    order: 1,
    notes: "",
    restrictionGroupId: null,
    ...fields,
  };
}

function createUnitGroup(fields: Partial<UnitGroup>): UnitGroup {
  return {
    id: "ug1",
    periodId: "p1",
    code: "A",
    name: "Scala A",
    parentId: null,
    address: null,
    notes: null,
    ...fields,
  };
}

function createWithholdingTax(
  fields: Partial<WithholdingTaxData>,
): WithholdingTaxData {
  return {
    periodId: "p1",
    code: "1019",
    name: "Società di persone",
    rate: 400,
    accountId: "la1",
    ...fields,
  };
}
