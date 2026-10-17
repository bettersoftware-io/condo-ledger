import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import { type Cents, cents } from "#/entities/cents.ts";
import type { Invoice, WithholdingTax } from "#/entities/invoice.ts";
import type { EntryDraft, JournalEntry } from "#/entities/journal.ts";
import { openInvoices } from "#/useCases/openInvoices.ts";

import type { JournalPort } from "../journalPort.ts";

/** What an adapter's test supplies so the contract can drive it. */
export interface JournalPortHarness {
  port: JournalPort;
  periodId: string;
  unknownPeriodId: string;
  /** Balanced, on the period's leaves. */
  acceptedDraft: EntryDraft;
  refusedDraft: EntryDraft;
  refusedReason: string;
  /** An entry canDeleteEntry accepts, not the last by number. */
  deletableEntryId: string;
  /** An entry of a kind the domain keeps: canDeleteEntry refuses it with kind-not-deletable. */
  undeletableEntryId: string;
  /** A generic entry of the period: canEditEntry accepts it, and acceptedDraft may replace it. */
  editableEntryId: string;
  /** A collection: canEditEntry refuses it. */
  uneditableEntryId: string;
  /** A registration the period accepts: its terms, and the postings they imply. */
  invoiceDraft: EntryDraft;
  /** The period's withholding catalogue, for the invoices' totals. */
  catalogue: WithholdingTax[];
  /** The period's suppliers account and a liquidity leaf: what a payment debits and credits. */
  suppliersAccountId: string;
  liquidityAccountId: string;
  teardown: () => void;
}

export function describeJournalPortContract(
  label: string,
  createHarness: () => JournalPortHarness,
): void {
  describe(`${label} :: JournalPort contract`, () => {
    it("answers a period's entries, all of that period, in number order", async () => {
      const { port, periodId, teardown } = createHarness();

      try {
        const entries = await firstValueFrom(port.entries(periodId));
        const numbers = entries.map((entry) => {
          return entry.number;
        });

        expect(entries.length).toBeGreaterThan(0);
        expect(
          entries.every((entry) => {
            return entry.periodId === periodId;
          }),
        ).toBe(true);
        expect(numbers).toEqual(
          [...numbers].sort((a, b) => {
            return a - b;
          }),
        );
      } finally {
        teardown();
      }
    });

    it("fails, naming the id, for a period it does not have", async () => {
      const { port, unknownPeriodId, teardown } = createHarness();

      try {
        await expect(
          firstValueFrom(port.entries(unknownPeriodId)),
        ).rejects.toThrow(unknownPeriodId);
      } finally {
        teardown();
      }
    });

    it("adds an entry: the next number, the port's stamp, the id it answers with, and every subscriber hears", async () => {
      const { port, periodId, acceptedDraft, teardown } = createHarness();
      const seen: JournalEntry[][] = [];
      const subscription = port.entries(periodId).subscribe((entries) => {
        seen.push(entries);
      });

      try {
        const before = seen.at(-1) ?? [];
        const result = await port.addEntry(periodId, acceptedDraft);

        expect(result.ok).toBe(true);

        const id = result.ok ? result.value.id : "";
        const added = seen.at(-1)?.find((entry) => {
          return entry.id === id;
        });

        expect(seen.at(-1)).toHaveLength(before.length + 1);
        expect(added).toMatchObject({
          periodId,
          number:
            Math.max(
              ...before.map((entry) => {
                return entry.number;
              }),
            ) + 1,
          kind: acceptedDraft.kind,
          description: acceptedDraft.description,
          postings: acceptedDraft.postings,
        });
        expect(added?.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      } finally {
        subscription.unsubscribe();
        teardown();
      }
    });

    it("refuses a draft with the domain's reason and leaves the journal as it was", async () => {
      const { port, periodId, refusedDraft, refusedReason, teardown } =
        createHarness();

      try {
        const before = await firstValueFrom(port.entries(periodId));

        expect(await port.addEntry(periodId, refusedDraft)).toEqual({
          ok: false,
          reason: refusedReason,
        });
        expect(await firstValueFrom(port.entries(periodId))).toEqual(before);
      } finally {
        teardown();
      }
    });

    it("rejects an entry for a period it does not have", async () => {
      const { port, unknownPeriodId, acceptedDraft, teardown } =
        createHarness();

      try {
        await expect(
          port.addEntry(unknownPeriodId, acceptedDraft),
        ).rejects.toThrow(unknownPeriodId);
      } finally {
        teardown();
      }
    });

    it("deletes an entry and closes the gap in the numbering", async () => {
      const { port, periodId, deletableEntryId, teardown } = createHarness();

      try {
        const before = await firstValueFrom(port.entries(periodId));

        expect(await port.deleteEntry(deletableEntryId)).toEqual({ ok: true });

        const after = await firstValueFrom(port.entries(periodId));

        expect(after).toHaveLength(before.length - 1);
        expect(
          after.some((entry) => {
            return entry.id === deletableEntryId;
          }),
        ).toBe(false);
        expect(
          after.map((entry) => {
            return entry.number;
          }),
        ).toEqual(
          after.map((_, index) => {
            return index + 1;
          }),
        );
      } finally {
        teardown();
      }
    });

    it("refuses to delete a kind the domain keeps, and leaves the journal as it was", async () => {
      const { port, periodId, undeletableEntryId, teardown } = createHarness();

      try {
        const before = await firstValueFrom(port.entries(periodId));

        expect(await port.deleteEntry(undeletableEntryId)).toEqual({
          ok: false,
          reason: "kind-not-deletable",
        });
        expect(await firstValueFrom(port.entries(periodId))).toEqual(before);
      } finally {
        teardown();
      }
    });

    it("rejects a delete of an entry it does not have", async () => {
      const { port, teardown } = createHarness();

      try {
        await expect(port.deleteEntry("nope")).rejects.toThrow("nope");
      } finally {
        teardown();
      }
    });

    it("registers an invoice with its entry: the invoices read it back, and the entry names it", async () => {
      const { port, periodId, invoiceDraft, teardown } = createHarness();

      try {
        const added = await port.addEntry(periodId, invoiceDraft);
        const id = added.ok ? added.value.id : "";
        const invoice = (await firstValueFrom(port.invoices(periodId))).find(
          (candidate) => {
            return candidate.entryId === id;
          },
        );

        const entry = (await firstValueFrom(port.entries(periodId))).find(
          (candidate) => {
            return candidate.id === id;
          },
        );

        expect(added.ok).toBe(true);
        expect(invoice).toMatchObject({ ...invoiceDraft.invoice, periodId });
        expect(entry?.invoiceId).toBe(invoice?.id);
      } finally {
        teardown();
      }
    });

    it("fails, naming the id, to answer the invoices of a period it does not have", async () => {
      const { port, unknownPeriodId, teardown } = createHarness();

      try {
        await expect(
          firstValueFrom(port.invoices(unknownPeriodId)),
        ).rejects.toThrow(unknownPeriodId);
      } finally {
        teardown();
      }
    });

    it("a payment of the remainder takes the invoice out of the open invoices", async () => {
      const harness = createHarness();
      const { port, periodId, catalogue, teardown } = harness;

      try {
        const invoice = await register(harness);
        const before = await openOf(harness, invoice);

        expect(before).toBeGreaterThan(0);
        expect(
          await port.addEntry(periodId, paymentOf(harness, invoice, before)),
        ).toMatchObject({ ok: true });
        expect(
          openInvoices(
            await firstValueFrom(port.invoices(periodId)),
            await firstValueFrom(port.entries(periodId)),
            catalogue,
          ).some((open) => {
            return open.invoice.id === invoice.id;
          }),
        ).toBe(false);
      } finally {
        teardown();
      }
    });

    it("replaces an entry in place: the same id, number and stamp, the draft's lines, and every subscriber hears", async () => {
      const { port, periodId, editableEntryId, acceptedDraft, teardown } =
        createHarness();
      const seen: JournalEntry[][] = [];
      const subscription = port.entries(periodId).subscribe((entries) => {
        seen.push(entries);
      });

      try {
        const before = entryOf(seen.at(-1), editableEntryId);

        expect(await port.replaceEntry(editableEntryId, acceptedDraft)).toEqual(
          { ok: true },
        );
        expect(seen.at(-1)).toHaveLength(seen[0]?.length ?? 0);
        expect(entryOf(seen.at(-1), editableEntryId)).toEqual({
          ...before,
          description: acceptedDraft.description,
          postings: acceptedDraft.postings,
        });
      } finally {
        subscription.unsubscribe();
        teardown();
      }
    });

    it("refuses a replacement of another kind with kind-changed, and leaves the journal as it was", async () => {
      const { port, periodId, editableEntryId, acceptedDraft, teardown } =
        createHarness();

      try {
        const before = await firstValueFrom(port.entries(periodId));

        expect(
          await port.replaceEntry(editableEntryId, {
            ...acceptedDraft,
            kind: "directPaymentCash",
          }),
        ).toEqual({ ok: false, reason: "kind-changed" });
        expect(await firstValueFrom(port.entries(periodId))).toEqual(before);
      } finally {
        teardown();
      }
    });

    it("refuses to replace a kind no wizard edits, with kind-not-editable", async () => {
      const { port, periodId, uneditableEntryId, acceptedDraft, teardown } =
        createHarness();

      try {
        const before = await firstValueFrom(port.entries(periodId));

        expect(
          await port.replaceEntry(uneditableEntryId, acceptedDraft),
        ).toEqual({ ok: false, reason: "kind-not-editable" });
        expect(await firstValueFrom(port.entries(periodId))).toEqual(before);
      } finally {
        teardown();
      }
    });

    it("refuses a replacement with the domain's reason", async () => {
      const { port, editableEntryId, refusedDraft, refusedReason, teardown } =
        createHarness();

      try {
        expect(await port.replaceEntry(editableEntryId, refusedDraft)).toEqual({
          ok: false,
          reason: refusedReason,
        });
      } finally {
        teardown();
      }
    });

    it("rejects a replacement of an entry it does not have", async () => {
      const { port, acceptedDraft, teardown } = createHarness();

      try {
        await expect(port.replaceEntry("nope", acceptedDraft)).rejects.toThrow(
          "nope",
        );
      } finally {
        teardown();
      }
    });

    it("refuses to delete a paid invoice's registration; an unpaid one goes, and its invoice with it", async () => {
      const harness = createHarness();
      const { port, periodId, teardown } = harness;

      try {
        const paid = await register(harness);

        await port.addEntry(periodId, paymentOf(harness, paid, cents(1)));

        expect(await port.deleteEntry(paid.entryId)).toEqual({
          ok: false,
          reason: "invoice-has-payments",
        });

        const unpaid = await register(harness);

        expect(await port.deleteEntry(unpaid.entryId)).toEqual({ ok: true });
        expect(
          (await firstValueFrom(port.invoices(periodId))).map((invoice) => {
            return invoice.id;
          }),
        ).toContain(paid.id);
        expect(
          (await firstValueFrom(port.invoices(periodId))).some((invoice) => {
            return invoice.id === unpaid.id;
          }),
        ).toBe(false);
      } finally {
        teardown();
      }
    });
  });
}

/** Registers the harness's invoice and answers the invoice the port made of it. */
async function register(harness: JournalPortHarness): Promise<Invoice> {
  const { port, periodId, invoiceDraft } = harness;
  const added = await harness.port.addEntry(periodId, invoiceDraft);

  if (!added.ok) {
    throw new Error(`refused: the harness's invoice draft (${added.reason})`);
  }

  const invoice = (await firstValueFrom(port.invoices(periodId))).find(
    (candidate) => {
      return candidate.entryId === added.value.id;
    },
  );

  if (invoice === undefined) {
    throw new Error(`missing: the invoice of the entry ${added.value.id}`);
  }

  return invoice;
}

/** What the invoice still owes, as the domain works it out from the port's invoices and entries. */
async function openOf(
  harness: JournalPortHarness,
  invoice: Invoice,
): Promise<Cents> {
  const { port, periodId, catalogue } = harness;
  const open = openInvoices(
    await firstValueFrom(port.invoices(periodId)),
    await firstValueFrom(port.entries(periodId)),
    catalogue,
  ).find((candidate) => {
    return candidate.invoice.id === invoice.id;
  });

  return open?.remaining ?? cents(0);
}

/** A payment of the invoice from the harness's liquidity account. */
function paymentOf(
  harness: JournalPortHarness,
  invoice: Invoice,
  amount: Cents,
): EntryDraft {
  return {
    kind: "invoicePayment",
    description: `Payment of invoice ${invoice.number}`,
    postings: [
      {
        accountId: harness.suppliersAccountId,
        debit: amount,
        credit: cents(0),
        counterpart: { kind: "supplier", id: invoice.supplierId },
      },
      {
        accountId: harness.liquidityAccountId,
        debit: cents(0),
        credit: amount,
        counterpart: null,
      },
    ],
    invoiceId: invoice.id,
  };
}

function entryOf(
  entries: JournalEntry[] | undefined,
  id: string,
): JournalEntry | undefined {
  return entries?.find((entry) => {
    return entry.id === id;
  });
}
