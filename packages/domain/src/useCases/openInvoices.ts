import { type Cents, cents, subtractCents } from "../entities/cents.ts";
import type {
  Invoice,
  InvoiceTotals,
  Rate,
  WithholdingTax,
} from "../entities/invoice.ts";
import type { JournalEntry } from "../entities/journal.ts";
import { must } from "../support/must.ts";
import { invoiceTotals } from "./invoice.ts";

/** An invoice that still owes its supplier something: its totals, what its payments paid and what is left. */
export interface OpenInvoice {
  invoice: Invoice;
  totals: InvoiceTotals;
  paid: Cents;
  remaining: Cents;
}

/** The invoices their payments have not settled, by due date (none last), then date, then number. */
export function openInvoices(
  invoices: Invoice[],
  entries: JournalEntry[],
  withholdingTaxes: WithholdingTax[],
): OpenInvoice[] {
  return invoices
    .map((invoice) => {
      const totals = invoiceTotals(
        invoice,
        withholdingRateOf(invoice, withholdingTaxes),
      );
      const paid = paidOn(invoice.id, entries);

      return {
        invoice,
        totals,
        paid,
        remaining: subtractCents(totals.dueToSupplier, paid),
      };
    })
    .filter((open) => {
      return open.remaining > 0;
    })
    .sort((a, b) => {
      return compareInvoices(a.invoice, b.invoice);
    });
}

/** What the payments naming the invoice have paid: their debits on the suppliers account, the debit with a supplier counterpart. */
export function paidOn(invoiceId: string, entries: JournalEntry[]): Cents {
  let paid = 0;

  for (const entry of entries) {
    if (entry.kind !== "invoicePayment" || entry.invoiceId !== invoiceId) {
      continue;
    }

    for (const posting of entry.postings) {
      if (posting.counterpart?.kind === "supplier") {
        paid += posting.debit;
      }
    }
  }

  return cents(paid);
}

function withholdingRateOf(
  invoice: Invoice,
  withholdingTaxes: WithholdingTax[],
): Rate | null {
  const code = invoice.withholdingCode;

  if (code === null) {
    return null;
  }

  return must(
    withholdingTaxes.find((tax) => {
      return tax.periodId === invoice.periodId && tax.code === code;
    }),
    `the withholding tax ${code} of the period ${invoice.periodId}`,
  ).rate;
}

function compareInvoices(a: Invoice, b: Invoice): number {
  return (
    compareDueDates(a.dueDate, b.dueDate) ||
    a.date.localeCompare(b.date) ||
    a.number.localeCompare(b.number, "en", { numeric: true })
  );
}

function compareDueDates(a: string | null, b: string | null): number {
  if (a === null || b === null) {
    return (a === null ? 1 : 0) - (b === null ? 1 : 0);
  }

  return a.localeCompare(b);
}
