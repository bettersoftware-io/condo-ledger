import { describe, expect, it } from "vitest";

import { cents } from "#/entities/cents.ts";
import type { SupplierLink } from "#/entities/contact.ts";
import { type Invoice, rate } from "#/entities/invoice.ts";
import type { Counterpart, JournalEntry } from "#/entities/journal.ts";

import {
  createCompanyContact,
  createPersonContact,
} from "../testing/createContacts.ts";
import { legacySeedData } from "./seed/legacySeed.generated.ts";
import { loadLegacySeed } from "./seed/legacySeed.ts";
import { periodSuppliers, seededSuppliers } from "./seededParties.ts";

describe("periodSuppliers", () => {
  it("answers the building's links alone, named by their contacts, in the order of the ids' numbers", () => {
    expect(
      periodSuppliers({
        buildingId: "c1",
        links: [createLink("c1", "md10"), createLink("c1", "md2")],
        invoices: [],
        entries: [],
        contacts,
      }),
    ).toEqual([
      { kind: "supplier", id: "md2", name: "Beta S.p.A." },
      { kind: "supplier", id: "md10", name: "Decima s.r.l." },
    ]);
  });

  it("leaves another building's links out", () => {
    expect(
      periodSuppliers({
        buildingId: "c1",
        links: [createLink("c2", "md2")],
        invoices: [],
        entries: [],
        contacts,
      }),
    ).toEqual([]);
  });

  it("adds a contact with an invoice in the period", () => {
    expect(
      periodSuppliers({
        buildingId: "c1",
        links: [],
        invoices: [createInvoice("md9")],
        entries: [],
        contacts,
      }),
    ).toEqual([{ kind: "supplier", id: "md9", name: "Rossi Mario" }]);
  });

  it("adds a contact a supplier posting names, and nobody for an owner's or none", () => {
    expect(
      periodSuppliers({
        buildingId: "c1",
        links: [],
        invoices: [],
        entries: [
          createEntry([
            { kind: "supplier", id: "md10" },
            { kind: "owner", id: "md2" },
            null,
          ]),
        ],
        contacts,
      }),
    ).toEqual([{ kind: "supplier", id: "md10", name: "Decima s.r.l." }]);
  });

  it("answers each contact once, however many times it is named", () => {
    expect(
      periodSuppliers({
        buildingId: "c1",
        links: [createLink("c1", "md2")],
        invoices: [createInvoice("md2"), createInvoice("md2")],
        entries: [createEntry([{ kind: "supplier", id: "md2" }])],
        contacts,
      }),
    ).toEqual([{ kind: "supplier", id: "md2", name: "Beta S.p.A." }]);
  });

  it("throws, naming a supplier the contacts lack", () => {
    expect(() => {
      return periodSuppliers({
        buildingId: "c1",
        links: [createLink("c1", "md7")],
        invoices: [],
        entries: [],
        contacts,
      });
    }).toThrow("missing: the contact md7");
  });

  it.each([
    ["c1", "p1"],
    ["c19", "p36"],
  ])("answers the seed's own suppliers for %s's %s", (buildingId, periodId) => {
    const seed = loadLegacySeed(legacySeedData);

    expect(
      periodSuppliers({
        buildingId,
        links: seed.supplierLinks,
        invoices: seed.invoices.filter((invoice) => {
          return invoice.periodId === periodId;
        }),
        entries: seed.entries.filter((entry) => {
          return entry.periodId === periodId;
        }),
        contacts: seed.contacts,
      }),
    ).toEqual(seededSuppliers(seed, periodId));
  });

  const contacts = [
    createCompanyContact("md2", "Beta S.p.A."),
    createCompanyContact("md10", "Decima s.r.l."),
    createPersonContact("md9", "Rossi", "Mario"),
    createCompanyContact("md3", "Unused s.n.c."),
  ];
});

function createLink(buildingId: string, contactId: string): SupplierLink {
  return { buildingId, contactId };
}

function createInvoice(supplierId: string): Invoice {
  return {
    id: `inv-${supplierId}`,
    periodId: "p1",
    entryId: "e1",
    supplierId,
    number: "1",
    reason: "Canone",
    date: "2013-01-10",
    dueDate: null,
    costAccountId: "la21",
    taxable: cents(10000),
    socialSecurityRate: rate(0),
    vatRate: rate(0),
    nonTaxable: cents(0),
    withholdingCode: null,
    withholdingOnSocialSecurity: false,
  };
}

function createEntry(counterparts: (Counterpart | null)[]): JournalEntry {
  return {
    id: "e1",
    periodId: "p1",
    number: 1,
    at: "2013-01-10T10:00:00",
    kind: "generic",
    description: "Movimento",
    postings: counterparts.map((counterpart) => {
      return {
        accountId: "la4",
        debit: cents(0),
        credit: cents(0),
        counterpart,
      };
    }),
    invoiceId: null,
  };
}
