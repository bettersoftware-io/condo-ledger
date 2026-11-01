import type { Building } from "#/entities/building.ts";
import type { Contact, SupplierLink } from "#/entities/contact.ts";
import type { Invoice } from "#/entities/invoice.ts";
import type { JournalEntry } from "#/entities/journal.ts";
import type { OwnerParty } from "#/entities/party.ts";
import { ok, type Result, rejected } from "#/entities/result.ts";

/** The buildings where a contact is used, each once, by the first period that names it. */
export interface ContactUses {
  supplierOf: string[];
  residentOf: string[];
  onInvoicesOf: string[];
  inEntriesOf: string[];
}

export type ContactUsesById = Map<string, ContactUses>;

/** What one period of a building holds that can name a contact. */
export interface UsesOfPeriod {
  buildingId: string;
  residents: OwnerParty[];
  invoices: Invoice[];
  entries: JournalEntry[];
}

/**
 * Where each contact is used. A supplier counterpart's id is its contact's;
 * an owner counterpart's is a residency's, which reaches its contact through
 * the resident's `personId`.
 */
export function contactUsesOf(
  links: SupplierLink[],
  periods: UsesOfPeriod[],
): ContactUsesById {
  const uses: ContactUsesById = new Map();

  for (const link of links) {
    usesOf(uses, link.contactId).supplierOf.push(link.buildingId);
  }

  for (const period of periods) {
    const { buildingId } = period;
    const contactOfResidency = new Map<string, string>();

    for (const resident of period.residents) {
      contactOfResidency.set(resident.id, resident.personId);
      usesOf(uses, resident.personId).residentOf.push(buildingId);
    }

    for (const invoice of period.invoices) {
      usesOf(uses, invoice.supplierId).onInvoicesOf.push(buildingId);
    }

    for (const entry of period.entries) {
      for (const posting of entry.postings) {
        const { counterpart } = posting;

        if (counterpart === null) {
          continue;
        }

        const contactId =
          counterpart.kind === "supplier"
            ? counterpart.id
            : contactOfResidency.get(counterpart.id);

        if (contactId !== undefined) {
          usesOf(uses, contactId).inEntriesOf.push(buildingId);
        }
      }
    }
  }

  for (const found of uses.values()) {
    found.supplierOf = [...new Set(found.supplierOf)];
    found.residentOf = [...new Set(found.residentOf)];
    found.onInvoicesOf = [...new Set(found.onInvoicesOf)];
    found.inEntriesOf = [...new Set(found.inEntriesOf)];
  }

  return uses;
}

/**
 * Whether a contact may be deleted: not while it is a resident, a supplier,
 * on an invoice or in an entry. Checked in that order; the detail is the
 * name of the first building. The contact is in the signature for its
 * callers; the answer depends on its uses alone.
 */
export function validateContactDelete(
  _contact: Contact,
  uses: ContactUses | undefined,
  buildings: Building[],
): Result {
  if (uses === undefined) {
    return ok();
  }

  const reasons: [string, string[]][] = [
    ["is-resident", uses.residentOf],
    ["is-supplier", uses.supplierOf],
    ["on-invoice", uses.onInvoicesOf],
    ["in-entries", uses.inEntriesOf],
  ];

  for (const [reason, buildingIds] of reasons) {
    const [first] = buildingIds;

    if (first !== undefined) {
      const building = buildings.find((candidate) => {
        return candidate.id === first;
      });

      return rejected(reason, building?.name ?? first);
    }
  }

  return ok();
}

function usesOf(uses: ContactUsesById, contactId: string): ContactUses {
  const found = uses.get(contactId);

  if (found !== undefined) {
    return found;
  }

  const created: ContactUses = {
    supplierOf: [],
    residentOf: [],
    onInvoicesOf: [],
    inEntriesOf: [],
  };

  uses.set(contactId, created);

  return created;
}
