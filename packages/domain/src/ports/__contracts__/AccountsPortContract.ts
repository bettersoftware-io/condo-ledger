import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import type { Account } from "#/entities/account.ts";
import { cents } from "#/entities/cents.ts";
import type { EntryDraft } from "#/entities/journal.ts";
import type { Party } from "#/entities/party.ts";
import type { ContactDraft } from "#/useCases/contacts/validateContact.ts";

import type { AccountsPort } from "../accountsPort.ts";
import type { BuildingsPort } from "../buildingsPort.ts";
import type { ContactsPort } from "../contactsPort.ts";
import type { JournalPort } from "../journalPort.ts";

/** What an adapter's test supplies so the contract can drive it. */
export interface AccountsPortHarness {
  port: AccountsPort;
  periodId: string;
  unknownPeriodId: string;
  /** A regular account of nature expenses: the one kind a budget may be set on. */
  costLeafId: string;
  groupingId: string;
  teardown: () => void;
}

/** The accounts port with the ports that move its parties, all over one world: what `parties()` promises can only be seen across them. */
export interface PartiesGuaranteeHarness {
  port: AccountsPort;
  buildings: BuildingsPort;
  journal: JournalPort;
  contacts: ContactsPort;
  buildingId: string;
  /** A period of buildingId with invoices, and postings that name suppliers. */
  periodId: string;
  /** A company with no link to buildingId, on no invoice and no posting of the period. */
  otherContactId: string;
  /** A draft of otherContactId under another name, and that name. */
  renameDraft: ContactDraft;
  renamedName: string;
  /** A balanced entry of the period with a supplier posting to the contact. */
  createEntryDraft: (contactId: string) => EntryDraft;
  teardown: () => void;
}

/**
 * The guarantee `parties()` gives the books, and what makes it emit. Apart
 * from the port's contract because it needs the other ports: a simulator alone
 * answers its seed's parties, and it is what is wired over them that keeps it.
 */
export function describePartiesGuarantee(
  label: string,
  createHarness: () => PartiesGuaranteeHarness,
): void {
  describe(`${label} :: AccountsPort parties guarantee`, () => {
    it("answers every supplier an invoice or a posting of the period names, and nobody else, once no link is left", async () => {
      const { port, buildings, journal, buildingId, periodId, teardown } =
        createHarness();

      try {
        const invoices = await firstValueFrom(journal.invoices(periodId));
        const entries = await firstValueFrom(journal.entries(periodId));
        const postings = entries.flatMap((entry) => {
          return entry.postings;
        });

        const named = new Set([
          ...invoices.map((invoice) => {
            return invoice.supplierId;
          }),
          ...postings.flatMap((posting) => {
            return posting.counterpart?.kind === "supplier"
              ? [posting.counterpart.id]
              : [];
          }),
        ]);

        expect(invoices.length).toBeGreaterThan(0);
        expect(named.size).toBeGreaterThan(0);

        const links = await firstValueFrom(buildings.suppliers(buildingId));

        for (const contactId of links) {
          await buildings.removeSupplier(buildingId, contactId);
        }

        expect(
          new Set(supplierIdsOf(await firstValueFrom(port.parties(periodId)))),
        ).toEqual(named);
      } finally {
        teardown();
      }
    });

    it("emits a link added, and again when it goes", async () => {
      const {
        port,
        buildings,
        buildingId,
        periodId,
        otherContactId,
        teardown,
      } = createHarness();
      const seen: boolean[] = [];
      const subscription = port.parties(periodId).subscribe((parties) => {
        seen.push(supplierIdsOf(parties).includes(otherContactId));
      });

      try {
        await buildings.addSupplier(buildingId, otherContactId);

        expect(seen.at(-1)).toBe(true);

        await buildings.removeSupplier(buildingId, otherContactId);

        expect(seen.at(-1)).toBe(false);
      } finally {
        subscription.unsubscribe();
        teardown();
      }
    });

    it("emits a supplier an entry names, and again when the entry goes", async () => {
      const {
        port,
        journal,
        periodId,
        otherContactId,
        createEntryDraft,
        teardown,
      } = createHarness();
      const seen: boolean[] = [];
      const subscription = port.parties(periodId).subscribe((parties) => {
        seen.push(supplierIdsOf(parties).includes(otherContactId));
      });

      try {
        const added = await journal.addEntry(
          periodId,
          createEntryDraft(otherContactId),
        );

        if (!added.ok) {
          throw new Error(`the harness's entry was refused: ${added.reason}`);
        }

        expect(seen.at(-1)).toBe(true);

        await journal.deleteEntry(added.value.id);

        expect(seen.at(-1)).toBe(false);
      } finally {
        subscription.unsubscribe();
        teardown();
      }
    });

    it("emits a supplier's new name", async () => {
      const {
        port,
        buildings,
        contacts,
        buildingId,
        periodId,
        otherContactId,
        renameDraft,
        renamedName,
        teardown,
      } = createHarness();
      let parties: Party[] = [];
      const subscription = port.parties(periodId).subscribe((next) => {
        parties = next;
      });

      try {
        await buildings.addSupplier(buildingId, otherContactId);
        await contacts.editContact(otherContactId, renameDraft);

        expect(
          parties.find((party) => {
            return party.id === otherContactId;
          })?.name,
        ).toBe(renamedName);
      } finally {
        subscription.unsubscribe();
        teardown();
      }
    });
  });
}

export function describeAccountsPortContract(
  label: string,
  createHarness: () => AccountsPortHarness,
): void {
  describe(`${label} :: AccountsPort contract`, () => {
    it("answers a period's accounts, all of that period, at once", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const accounts = await firstValueFrom(port.accounts(periodId));

        expect(accounts.length).toBeGreaterThan(0);
        expect(
          accounts.every((account) => {
            return account.periodId === periodId;
          }),
        ).toBe(true);
      } finally {
        teardown();
      }
    });

    it("answers a period's parties", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        expect(
          Array.isArray(await firstValueFrom(port.parties(periodId))),
        ).toBe(true);
      } finally {
        teardown();
      }
    });

    it("answers a period's withholding catalogue, every code of that period", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const catalogue = await firstValueFrom(port.withholdingTaxes(periodId));

        expect(catalogue.length).toBeGreaterThan(0);
        expect(
          catalogue.every((tax) => {
            return tax.periodId === periodId;
          }),
        ).toBe(true);
      } finally {
        teardown();
      }
    });

    it("fails, naming the id, for a period it does not have", async () => {
      const { port, unknownPeriodId, teardown } = createHarness();

      try {
        await expect(
          firstValueFrom(port.accounts(unknownPeriodId)),
        ).rejects.toThrow(unknownPeriodId);
        await expect(
          firstValueFrom(port.parties(unknownPeriodId)),
        ).rejects.toThrow(unknownPeriodId);
        await expect(
          firstValueFrom(port.withholdingTaxes(unknownPeriodId)),
        ).rejects.toThrow(unknownPeriodId);
      } finally {
        teardown();
      }
    });

    it("sets a budget on a cost leaf and tells every subscriber", async () => {
      const { port, periodId, costLeafId, teardown } = createHarness();
      const seen: Account[][] = [];
      const subscription = port.accounts(periodId).subscribe((accounts) => {
        seen.push(accounts);
      });

      try {
        expect(await port.setBudget(costLeafId, cents(123456))).toEqual({
          ok: true,
        });
        expect(
          seen.at(-1)?.find((account) => {
            return account.id === costLeafId;
          })?.budget,
        ).toBe(123456);
      } finally {
        subscription.unsubscribe();
        teardown();
      }
    });

    it("refuses a budget on a grouping, with the domain's reason, changing nothing", async () => {
      const { port, periodId, groupingId, teardown } = createHarness();

      try {
        const before = await firstValueFrom(port.accounts(periodId));

        expect(await port.setBudget(groupingId, cents(1))).toEqual({
          ok: false,
          reason: "not-a-leaf",
        });
        expect(await firstValueFrom(port.accounts(periodId))).toEqual(before);
      } finally {
        teardown();
      }
    });

    it("fails for an account it does not have", async () => {
      const { port, teardown } = createHarness();

      try {
        await expect(port.setBudget("nope", cents(1))).rejects.toThrow("nope");
      } finally {
        teardown();
      }
    });
  });
}

function supplierIdsOf(parties: Party[]): string[] {
  return parties
    .filter((party) => {
      return party.kind === "supplier";
    })
    .map((party) => {
      return party.id;
    });
}
