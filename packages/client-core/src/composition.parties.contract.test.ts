import { cents, type EntryDraft, type LegacySeed } from "@cl/domain";
import { describePartiesGuarantee } from "@cl/domain/ports/__contracts__/AccountsPortContract.ts";
import { must } from "@cl/domain/support/must.ts";
import type { ContactDraft } from "@cl/domain/useCases/contacts/validateContact.ts";

import { createAppHarness } from "./testing/appHarness.ts";

const PERIOD = "p36";

describePartiesGuarantee("the composed simulators", () => {
  const { ports, seed } = createAppHarness();

  return {
    port: ports.accounts,
    buildings: ports.buildings,
    journal: ports.journal,
    contacts: ports.contacts,
    buildingId: "c19",
    periodId: PERIOD,
    otherContactId: companyLinkedNowhere(seed),
    renameDraft: createCompanyDraft("Gamma S.r.l."),
    renamedName: "Gamma S.r.l.",
    createEntryDraft: (contactId: string): EntryDraft => {
      return createEntryDraft(seed, contactId);
    },
    teardown: (): void => {},
  };
});

function companyLinkedNowhere(seed: LegacySeed): string {
  const linked = new Set(
    seed.supplierLinks.map((link) => {
      return link.contactId;
    }),
  );

  return must(
    seed.contacts.find((contact) => {
      return contact.kind === "company" && !linked.has(contact.id);
    }),
    "a company linked nowhere",
  ).id;
}

function accountOf(seed: LegacySeed, role: "cash" | "suppliers"): string {
  return must(
    seed.accounts.find((account) => {
      return account.periodId === PERIOD && account.role === role;
    }),
    `the ${role} account of ${PERIOD}`,
  ).id;
}

function createEntryDraft(seed: LegacySeed, contactId: string): EntryDraft {
  return {
    kind: "generic",
    description: "Giroconto",
    postings: [
      {
        accountId: accountOf(seed, "cash"),
        debit: cents(100),
        credit: cents(0),
        counterpart: null,
      },
      {
        accountId: accountOf(seed, "suppliers"),
        debit: cents(0),
        credit: cents(100),
        counterpart: { kind: "supplier", id: contactId },
      },
    ],
  };
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
