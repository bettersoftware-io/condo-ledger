import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import {
  type AccountNode,
  type Added,
  type ContactsPort,
  cents,
  type EntryDraft,
  type LegacySeed,
  nameOf,
  type Party,
  rate,
  type ScheduleNode,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";
import type { ContactDraft } from "@cl/domain/useCases/contacts/validateContact.ts";
import type { JournalEntryView } from "@cl/domain/useCases/journal.ts";
import type { UnitsRow } from "@cl/domain/useCases/units/unitsList.ts";

import type { App } from "./composition.ts";
import type { Books } from "./presenters/booksPresenter.ts";
import { createAppHarness } from "./testing/appHarness.ts";

describe("a resident's name is its contact's", () => {
  it("is the held name until the contacts say otherwise, and keeps the held name for a person the contacts lack", async () => {
    const seed = createSmallSeed();
    const { ports } = createAppHarness({
      ...seed,
      contacts: seed.contacts.filter((contact) => {
        return contact.id !== "md11";
      }),
    });
    const residents = await firstValueFrom(ports.units.residents("p1"));

    expect(
      residents.map((resident) => {
        return resident.name;
      }),
    ).toEqual(["Rossi Mario", "Rossi Mario", "Bianchi Anna"]);
  });

  it("follows a rename on the units port, the accounts parties, the Units view, the schedule and the journal, without another subscribe", async () => {
    const { app, ports } = createAppHarness(createSmallSeed());

    app.presenters.buildings.selectPeriod("p1");

    const residents: string[][] = [];
    let parties: Party[] = [];
    let unitRows: UnitsRow[] = [];
    let scheduleNodes: ScheduleNode[] = [];
    let entries: JournalEntryView[] = [];
    const subscriptions = [
      ports.units.residents("p1").subscribe((next) => {
        residents.push(
          next.map((resident) => {
            return resident.name;
          }),
        );
      }),
      ports.accounts.parties("p1").subscribe((next) => {
        parties = next;
      }),
      app.presenters.units.view$.subscribe((view) => {
        unitRows = flatten(view?.list.root, (row) => {
          return row.children;
        });
      }),
      app.presenters.schedule.schedule$.subscribe((schedule) => {
        scheduleNodes = flatten(schedule?.root, (node) => {
          return node.children;
        });
      }),
      app.presenters.journal.entries$.subscribe((next) => {
        entries = next;
      }),
    ];

    expect(
      await ports.contacts.editContact("md10", createPersonDraft()),
    ).toEqual({ ok: true });

    expect(residents.at(-1)).toEqual([
      "Verdi Luca",
      "Verdi Luca",
      "Bianchi Anna",
    ]);
    expect(
      parties
        .filter((party) => {
          return party.kind === "owner";
        })
        .map((party) => {
          return party.name;
        }),
    ).toEqual(["Verdi Luca", "Verdi Luca", "Bianchi Anna"]);
    expect(
      unitRows.some((row) => {
        return row.label.includes("Verdi Luca");
      }),
    ).toBe(true);
    expect(
      scheduleNodes.some((node) => {
        return node.kind === "resident" && node.label.includes("Verdi Luca");
      }),
    ).toBe(true);
    expect(
      entries
        .flatMap((entry) => {
          return entry.postings;
        })
        .some((posting) => {
          return posting.path.includes("Verdi Luca");
        }),
    ).toBe(true);
    expect(JSON.stringify([unitRows, scheduleNodes, entries])).not.toContain(
      "Rossi Mario",
    );

    for (const subscription of subscriptions) {
      subscription.unsubscribe();
    }
  });
});

describe("a building's suppliers", () => {
  it("offers a new link's contact on the invoice wizard for that building's periods, and not for the other's", async () => {
    const { app, ports, seed } = createAppHarness();
    const contactId = contactLinkedNowhere(seed.contacts, seed.supplierLinks);

    await ports.buildings.addSupplier("c19", contactId);

    app.presenters.buildings.selectPeriod("p36");

    expect(supplierChoices(app)).toContain(contactId);

    app.presenters.buildings.selectPeriod("p1");

    expect(supplierChoices(app)).not.toContain(contactId);
  });

  it("adds no row to the Accounts tree for a new link, and moves no figure of p1 or p36", async () => {
    const { app, ports, seed } = createAppHarness();
    const contactId = contactLinkedNowhere(seed.contacts, seed.supplierLinks);

    app.presenters.buildings.selectPeriod("p36");

    const p36 = booksOf(app).tree;

    app.presenters.buildings.selectPeriod("p1");

    const p1 = booksOf(app).tree;

    await ports.buildings.addSupplier("c1", contactId);
    await ports.buildings.addSupplier("c19", contactId);

    expect(booksOf(app).tree).toEqual(p1);

    app.presenters.buildings.selectPeriod("p36");

    expect(booksOf(app).tree).toEqual(p36);
  });

  it("keeps a removed supplier with invoices in the period, by name, in the parties, the tree and the journal", async () => {
    const { app, ports, seed } = createAppHarness();
    const { supplierId } = must(
      seed.invoices.find((invoice) => {
        return invoice.periodId === "p36";
      }),
      "an invoice of p36",
    );
    const name = nameOfContact(seed.contacts, supplierId);

    app.presenters.buildings.selectPeriod("p36");

    const before = booksOf(app).tree;
    const subscription = app.presenters.journal.entries$.subscribe();

    expect(await ports.buildings.removeSupplier("c19", supplierId)).toEqual({
      ok: true,
    });

    expect(await firstValueFrom(ports.accounts.parties("p36"))).toContainEqual({
      kind: "supplier",
      id: supplierId,
      name,
    });
    expect(booksOf(app).tree).toEqual(before);
    expect(
      (await firstValueFrom(app.presenters.journal.entries$))
        .flatMap((entry) => {
          return entry.postings;
        })
        .some((posting) => {
          return posting.path.includes(name);
        }),
    ).toBe(true);
    expect(supplierChoices(app)).toContain(supplierId);
    subscription.unsubscribe();
  });

  it("takes a removed supplier with nothing posted out of the wizard's choices", async () => {
    const { app, ports, seed } = createAppHarness();
    const contactId = contactLinkedNowhere(seed.contacts, seed.supplierLinks);

    app.presenters.buildings.selectPeriod("p36");
    await ports.buildings.addSupplier("c19", contactId);

    expect(supplierChoices(app)).toContain(contactId);

    await ports.buildings.removeSupplier("c19", contactId);

    expect(supplierChoices(app)).not.toContain(contactId);
  });

  it("shows a renamed supplier's new name in the Accounts tree and the Journal", async () => {
    const { app, ports } = createAppHarness(createSmallSeed());

    app.presenters.buildings.selectPeriod("p1");

    const parties: Party[][] = [];
    const subscriptions = [
      ports.accounts.parties("p1").subscribe((next) => {
        parties.push(next);
      }),
      app.presenters.journal.entries$.subscribe(),
    ];

    await ports.contacts.editContact("md2", createCompanyDraft("Gamma S.r.l."));

    expect(parties.at(-1)?.[1]).toEqual({
      kind: "supplier",
      id: "md2",
      name: "Gamma S.r.l.",
    });
    expect(labelsOf(booksOf(app).tree)).toContain("Gamma S.r.l.");
    expect(labelsOf(booksOf(app).tree)).not.toContain("Beta S.p.A.");
    expect(
      (await firstValueFrom(app.presenters.journal.entries$))
        .flatMap((entry) => {
          return entry.postings;
        })
        .filter((posting) => {
          return posting.key === "la4/md2";
        })
        .map((posting) => {
          return posting.path.includes("Gamma S.r.l.");
        }),
    ).toEqual([true, true]);

    for (const subscription of subscriptions) {
      subscription.unsubscribe();
    }
  });

  it("survives the last posting of a removed supplier being deleted: the half-written books are skipped", async () => {
    const { app, ports } = createAppHarness(createSmallSeed());
    const errors: unknown[] = [];

    app.presenters.buildings.selectPeriod("p1");

    const subscription = app.presenters.books.books$.subscribe({
      error: (error: unknown) => {
        errors.push(error);
      },
    });

    await ports.buildings.removeSupplier("c1", "md1");
    await ports.journal.deleteEntry("e1");

    expect(errors).toEqual([]);
    expect(labelsOf(booksOf(app).tree)).not.toContain("Alfa s.n.c.");
    expect(
      booksOf(app).parties.map((party) => {
        return party.id;
      }),
    ).not.toContain("md1");
    subscription.unsubscribe();
  });

  it("names a supplier a generic entry posts to outside the links, and the first posting brings it in", async () => {
    const { app, ports } = createAppHarness(createSmallSeed());
    const { id } = await addedContact(ports.contacts, "Gamma S.r.l.");

    app.presenters.buildings.selectPeriod("p1");

    expect(await ports.journal.addEntry("p1", createGenericDraft(id))).toEqual({
      ok: true,
      value: { id: "new1" },
    });
    expect(labelsOf(booksOf(app).tree)).toContain("Gamma S.r.l.");
  });

  it("judges an invoice's supplier by the links as they stand", async () => {
    const { ports } = createAppHarness(createSmallSeed());
    const { id } = await addedContact(ports.contacts, "Gamma S.r.l.");

    expect(await ports.journal.addEntry("p1", createInvoiceDraft(id))).toEqual({
      ok: false,
      reason: "unknown-supplier",
    });

    await ports.buildings.addSupplier("c1", id);

    expect(
      await ports.journal.addEntry("p1", createInvoiceDraft(id)),
    ).toMatchObject({ ok: true });
  });

  it("refuses to delete a contact while a new link names it, and takes the delete once the link goes", async () => {
    const { ports } = createAppHarness(createSmallSeed());
    const { id } = await addedContact(ports.contacts, "Gamma S.r.l.");

    await ports.buildings.addSupplier("c1", id);

    expect(await ports.contacts.deleteContact(id)).toEqual({
      ok: false,
      reason: "is-supplier",
      detail: "Pozzetto",
    });

    await ports.buildings.removeSupplier("c1", id);

    expect(await ports.contacts.deleteContact(id)).toEqual({ ok: true });
  });
});

function booksOf(app: App): Books {
  const books = app.presenters.books.books$.getValue();

  if (books === null) {
    throw new Error("no period is selected");
  }

  return books;
}

function supplierChoices(app: App): string[] {
  return app.machines
    .createInvoiceWizard(null)
    .state$.getValue()
    .choices.map((choice) => {
      return choice.key;
    });
}

function labelsOf(tree: AccountNode): string[] {
  return flatten(tree, (node) => {
    return node.children;
  }).map((node) => {
    return node.label;
  });
}

function contactLinkedNowhere(
  contacts: LegacySeed["contacts"],
  links: LegacySeed["supplierLinks"],
): string {
  const linked = new Set(
    links.map((link) => {
      return link.contactId;
    }),
  );

  return must(
    contacts.find((contact) => {
      return contact.kind === "company" && !linked.has(contact.id);
    }),
    "a company linked nowhere",
  ).id;
}

function nameOfContact(
  contacts: LegacySeed["contacts"],
  contactId: string,
): string {
  return nameOf(
    must(
      contacts.find((contact) => {
        return contact.id === contactId;
      }),
      `the contact ${contactId}`,
    ),
  );
}

async function addedContact(
  contacts: ContactsPort,
  companyName: string,
): Promise<Added> {
  const result = await contacts.addContact(createCompanyDraft(companyName));

  if (!result.ok) {
    throw new Error(`the contact was refused: ${result.reason}`);
  }

  return result.value;
}

function flatten<T>(root: T | undefined, childrenOf: (node: T) => T[]): T[] {
  if (root === undefined) {
    return [];
  }

  return [
    root,
    ...childrenOf(root).flatMap((child) => {
      return flatten(child, childrenOf);
    }),
  ];
}

function createCompanyDraft(companyName: string): ContactDraft {
  return {
    kind: "company",
    status: "active",
    code: null,
    categoryId: null,
    salutation: null,
    taxCode: null,
    vatNumber: null,
    postalAddress: null,
    language: null,
    notes: null,
    rows: [],
    companyName,
    registeredOffice: null,
    taxDomicile: null,
  };
}

function createGenericDraft(supplierId: string): EntryDraft {
  return {
    kind: "generic",
    description: "Giroconto",
    postings: [
      {
        accountId: "la2",
        debit: cents(100),
        credit: cents(0),
        counterpart: null,
      },
      {
        accountId: "la4",
        debit: cents(0),
        credit: cents(100),
        counterpart: { kind: "supplier", id: supplierId },
      },
    ],
  };
}

function createInvoiceDraft(supplierId: string): EntryDraft {
  return {
    kind: "invoice",
    description: "Fattura Gamma",
    postings: [
      {
        accountId: "la21",
        debit: cents(10000),
        credit: cents(0),
        counterpart: null,
      },
      {
        accountId: "la4",
        debit: cents(0),
        credit: cents(10000),
        counterpart: { kind: "supplier", id: supplierId },
      },
    ],
    invoice: {
      supplierId,
      number: "7",
      reason: "Ascensore",
      date: "2013-04-23",
      dueDate: null,
      costAccountId: "la21",
      taxable: cents(10000),
      socialSecurityRate: rate(0),
      vatRate: rate(0),
      nonTaxable: cents(0),
      withholdingCode: null,
      withholdingOnSocialSecurity: false,
    },
  };
}

function createPersonDraft(): ContactDraft {
  return {
    kind: "person",
    status: "active",
    code: null,
    categoryId: null,
    salutation: null,
    taxCode: null,
    vatNumber: null,
    postalAddress: null,
    language: null,
    notes: null,
    rows: [],
    firstName: "Luca",
    lastName: "Verdi",
    gender: null,
    birthDate: null,
    birthPlace: null,
    officeAddress: null,
    residenceAddress: null,
    domicileAddress: null,
  };
}
