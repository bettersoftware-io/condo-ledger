import { describe, expect, it } from "vitest";

import type {
  Building,
  ContactCategory,
  InvoiceData,
  JournalEntryData,
  LegacySeedData,
} from "@cl/domain";
import { createPersonContact } from "@cl/domain/testing/createContacts.ts";

import { shiftLegacySeed, yearsFor } from "./shiftSeed.ts";

describe("yearsFor", () => {
  it("moves a building the whole way when its periods' years keep their length", () => {
    expect(yearsFor(createBuilding("c2", "p36", "2013"), 13)).toBe(13);
  });

  it("moves it less when the whole way would land a period on a leap year", () => {
    expect(yearsFor(createBuilding("c1", "p1", "2011"), 13)).toBe(12);
  });

  it("keeps every year of a period that spans two", () => {
    const building = createBuilding("c1", "p1", "2011");
    const [period] = building.periods;

    expect(
      yearsFor(
        {
          ...building,
          periods:
            period === undefined ? [] : [{ ...period, end: "2012-06-30" }],
        },
        14,
      ),
    ).toBe(12);
  });
});

describe("shiftLegacySeed", () => {
  it("moves a building, its period and the period's name by the building's years", () => {
    const [saturno, pozzetto] = shiftLegacySeed(createSeed({}), 13).buildings;

    expect(saturno?.createdOn).toBe("2023-04-14 13:52:24");
    expect(saturno?.modifiedOn).toBe("2024-12-18 15:41:01");
    expect(saturno?.periods[0]).toMatchObject({
      name: "2023",
      start: "2023-01-01",
      end: "2023-12-31",
      notes: "Closed with the 2023 accounts",
    });
    expect(pozzetto?.periods[0]).toMatchObject({
      name: "2026",
      start: "2026-01-01",
      end: "2026-12-31",
    });
  });

  it("moves a record with its period's building", () => {
    const entries = shiftLegacySeed(
      createSeed({
        entries: [
          createEntry({ periodId: "p1", at: "2011-05-02T10:00:00" }),
          createEntry({ periodId: "p36", at: "2013-01-10T15:59:29" }),
        ],
      }),
      13,
    ).entries.map((entry) => {
      return entry.at;
    });

    expect(entries).toEqual(["2023-05-02T10:00:00", "2026-01-10T15:59:29"]);
  });

  it("leaves a building's construction date and a person's birth date", () => {
    const seed = shiftLegacySeed(
      createSeed({
        buildings: [
          {
            ...createBuilding("c2", "p36", "2013"),
            constructionDate: "1980-05-20",
          },
        ],
        contacts: [
          createPersonContact("md1", "Rossi", "Anna", {
            birthDate: "1958-03-02",
          }),
        ],
      }),
      13,
    );

    expect(seed.buildings[0]?.constructionDate).toBe("1980-05-20");
    expect(seed.contacts[0]).toMatchObject({ birthDate: "1958-03-02" });
  });

  it("moves the dates and years in an entry's description", () => {
    const [entry] = shiftLegacySeed(
      createSeed({
        entries: [
          createEntry({
            description:
              "Invoice no. 7736 of 13/01/2013: Gas bill December '09 - January '10",
          }),
        ],
      }),
      13,
    ).entries;

    expect(entry?.description).toBe(
      "Invoice no. 7736 of 13/01/2026: Gas bill December '22 - January '23",
    );
  });

  it.each([
    ["Electricity bill Jan-Feb 2011", "Electricity bill Jan-Feb 2024"],
    [
      "Installment collection 2011 (Ordinary) no. 1",
      "Installment collection 2024 (Ordinary) no. 1",
    ],
    [
      "Lighting bill, supply no. 395 123 456",
      "Lighting bill, supply no. 395 123 456",
    ],
    ["Invoice no. 2011-B of 2013", "Invoice no. 2011-B of 2026"],
  ])("rewrites the years in %s", (description, shifted) => {
    const [entry] = shiftLegacySeed(
      createSeed({ entries: [createEntry({ description })] }),
      13,
    ).entries;

    expect(entry?.description).toBe(shifted);
  });

  it("moves an invoice's dates and leaves its number", () => {
    const [invoice] = shiftLegacySeed(
      createSeed({
        invoices: [
          createInvoice({
            number: "2011",
            date: "2012-12-01",
            dueDate: "2013-01-31",
            reason: "Heating 2012",
          }),
        ],
      }),
      13,
    ).invoices;

    expect(invoice).toMatchObject({
      number: "2011",
      date: "2025-12-01",
      dueDate: "2026-01-31",
      reason: "Heating 2025",
    });
  });

  it("keeps a missing due date missing", () => {
    const invoices = shiftLegacySeed(
      createSeed({ invoices: [createInvoice({ dueDate: null })] }),
      13,
    ).invoices;

    expect(invoices[0]?.dueDate).toBeNull();
  });

  it("puts 29 February on the 28th in a year that has no such day, and keeps it in one that has", () => {
    const entries = shiftLegacySeed(
      createSeed({
        entries: [
          createEntry({
            at: "2012-02-29T10:00:00",
            description: "Paid on 29/02/2012",
          }),
          createEntry({ periodId: "p1", at: "2012-02-29T10:00:00" }),
        ],
      }),
      13,
    ).entries;

    expect(entries[0]?.at).toBe("2025-02-28T10:00:00");
    expect(entries[0]?.description).toBe("Paid on 28/02/2025");
    expect(entries[1]?.at).toBe("2024-02-29T10:00:00");
  });

  it("stops on a date field that holds no ISO date", () => {
    expect(() => {
      return shiftLegacySeed(
        createSeed({ entries: [createEntry({ at: "10/01/2013" })] }),
        13,
      );
    }).toThrow('"10/01/2013" is not an ISO date');
  });

  it("stops on a record of a period no building holds", () => {
    expect(() => {
      return shiftLegacySeed(
        createSeed({ entries: [createEntry({ periodId: "p9" })] }),
        13,
      );
    }).toThrow("entries names period p9, which no building holds");
  });

  it("stops on a record that holds a date and belongs to no period", () => {
    const dated = { id: "cc1", name: "Old", createdOn: "2013-01-01" };

    expect(() => {
      return shiftLegacySeed(
        createSeed({ contactCategories: [dated as ContactCategory] }),
        13,
      );
    }).toThrow(
      "a record of contactCategories holds a date and belongs to no period",
    );
  });
});

/** Saturno over p1 (2011) and Pozzetto over p36 (2013), and the records given. */
function createSeed(records: Partial<LegacySeedData>): LegacySeedData {
  return {
    buildings: [
      createBuilding("c1", "p1", "2011"),
      createBuilding("c2", "p36", "2013"),
    ],
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
    ...records,
  };
}

function createBuilding(id: string, periodId: string, year: string): Building {
  return {
    id,
    name: "Saturno",
    code: "SAT",
    type: "building",
    status: "active",
    address: null,
    taxCode: null,
    constructionDate: null,
    cadastralData: null,
    notes: null,
    createdOn: "2011-04-14 13:52:24",
    modifiedOn: "2012-12-18 15:41:01",
    periods: [
      {
        id: periodId,
        name: year,
        type: "ordinary",
        start: `${year}-01-01`,
        end: `${year}-12-31`,
        closed: false,
        notes: `Closed with the ${year} accounts`,
      },
    ],
  };
}

function createEntry(fields: Partial<JournalEntryData>): JournalEntryData {
  return {
    id: "tx1",
    periodId: "p36",
    number: 1,
    at: "2013-01-10T15:59:29",
    kind: "generic",
    description: "",
    postings: [],
    invoiceId: null,
    ...fields,
  };
}

function createInvoice(fields: Partial<InvoiceData>): InvoiceData {
  return {
    id: "li1",
    periodId: "p36",
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
