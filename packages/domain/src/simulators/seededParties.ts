import { type Contact, nameOf, type SupplierLink } from "#/entities/contact.ts";
import type { Invoice } from "#/entities/invoice.ts";
import type { JournalEntry } from "#/entities/journal.ts";
import type { OwnerParty, Party, SupplierParty } from "#/entities/party.ts";
import { must } from "#/support/must.ts";

import type { LegacySeed } from "./seed/legacySeed.ts";

/** What a period's suppliers are worked out from: its building, and the links, invoices, entries and contacts as they stand. */
export interface SuppliersInput {
  buildingId: string;
  links: SupplierLink[];
  invoices: Invoice[];
  entries: JournalEntry[];
  contacts: Contact[];
}

/**
 * The one rule for a period's suppliers: the building's links, plus any
 * contact with an invoice or a supplier posting in the period, so what is
 * posted keeps its name once its link is gone. Each once, in the order of the
 * contact id's number, as the seed's parties are, named by the contact. A
 * contact the contacts lack is a defect, and throws.
 */
export function periodSuppliers(period: SuppliersInput): SupplierParty[] {
  const contacts = new Map(
    period.contacts.map((contact) => {
      return [contact.id, contact];
    }),
  );

  const ids = new Set([
    ...period.links
      .filter((link) => {
        return link.buildingId === period.buildingId;
      })
      .map((link) => {
        return link.contactId;
      }),
    ...period.invoices.map((invoice) => {
      return invoice.supplierId;
    }),
    ...postedSuppliers(period.entries),
  ]);

  return [...ids].sort(byContactNumber).map((id) => {
    return {
      kind: "supplier",
      id,
      name: nameOf(must(contacts.get(id), `the contact ${id}`)),
    };
  });
}

/** The seed's suppliers of one period: what a simulator reads when no suppliers reader is wired in. */
export function seededSuppliers(
  seed: LegacySeed,
  periodId: string,
): SupplierParty[] {
  return partiesOf(seed, periodId).filter((party) => {
    return party.kind === "supplier";
  });
}

/** The seed's residents of one period: what a simulator reads when no units simulator is wired in. */
export function seededResidents(
  seed: LegacySeed,
  periodId: string,
): OwnerParty[] {
  return partiesOf(seed, periodId).filter((party) => {
    return party.kind === "owner";
  });
}

function postedSuppliers(entries: JournalEntry[]): string[] {
  return entries.flatMap((entry) => {
    return entry.postings.flatMap((posting) => {
      return posting.counterpart?.kind === "supplier"
        ? [posting.counterpart.id]
        : [];
    });
  });
}

/** Contact ids are `md<n>`. */
function byContactNumber(a: string, b: string): number {
  return Number(a.slice(2)) - Number(b.slice(2));
}

function partiesOf(seed: LegacySeed, periodId: string): Party[] {
  return (
    seed.parties.find((list) => {
      return list.periodId === periodId;
    })?.parties ?? []
  );
}
