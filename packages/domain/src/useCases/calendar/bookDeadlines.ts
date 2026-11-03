import { cents, subtractCents } from "#/entities/cents.ts";
import type {
  Deadline,
  InstallmentDeadline,
  InvoiceDeadline,
} from "#/entities/deadline.ts";
import type { Installment, InstallmentItem } from "#/entities/installment.ts";
import type { Invoice, WithholdingTax } from "#/entities/invoice.ts";
import type { JournalEntry } from "#/entities/journal.ts";
import { itemBalances } from "#/useCases/installments.ts";
import { invoiceTotals } from "#/useCases/invoice.ts";
import { paidOn, withholdingRateOf } from "#/useCases/openInvoices.ts";

import { addDays } from "./month.ts";

/** Everything of one period the books work its deadlines out from. */
export interface PeriodBooks {
  buildingId: string;
  periodId: string;
  installments: Installment[];
  items: InstallmentItem[];
  entries: JournalEntry[];
  invoices: Invoice[];
  withholdingTaxes: WithholdingTax[];
}

const ASSUMED_DUE_DAYS = 30;

/**
 * The deadlines of a period: one for each installment, on its due date, and
 * one for each invoice, on its due date or 30 days after its date. A deadline
 * is closed when nothing is left to pay on it (an installment of zero items
 * is closed), new otherwise.
 */
export function bookDeadlines(books: PeriodBooks): Deadline[] {
  return [...installmentDeadlines(books), ...invoiceDeadlines(books)];
}

function installmentDeadlines(books: PeriodBooks): InstallmentDeadline[] {
  const balances = itemBalances(books.items, books.installments, books.entries);

  return books.installments.map((installment) => {
    let total = 0;
    let paid = 0;

    for (const balance of balances) {
      if (balance.installment.id === installment.id) {
        total += balance.item.amount;
        paid += balance.paid;
      }
    }

    const remaining = subtractCents(cents(total), cents(paid));

    return {
      source: "installment",
      id: `installment:${installment.id}`,
      date: installment.dueDate,
      time: null,
      calendar: "installments",
      buildingId: books.buildingId,
      status: remaining <= 0 ? "closed" : "new",
      priority: "none",
      periodId: books.periodId,
      installmentId: installment.id,
      installmentName: installment.name,
      installmentNumber: installment.number,
      total: cents(total),
      paid: cents(paid),
      remaining,
    };
  });
}

function invoiceDeadlines(books: PeriodBooks): InvoiceDeadline[] {
  return books.invoices.map((invoice) => {
    const total = invoiceTotals(
      invoice,
      withholdingRateOf(invoice, books.withholdingTaxes),
    ).dueToSupplier;
    const paid = paidOn(invoice.id, books.entries);
    const remaining = subtractCents(total, paid);

    return {
      source: "invoice",
      id: `invoice:${invoice.id}`,
      date: invoice.dueDate ?? addDays(invoice.date, ASSUMED_DUE_DAYS),
      time: null,
      calendar: "invoices",
      buildingId: books.buildingId,
      status: remaining <= 0 ? "closed" : "new",
      priority: "none",
      periodId: books.periodId,
      invoiceId: invoice.id,
      supplierId: invoice.supplierId,
      invoiceNumber: invoice.number,
      invoiceDate: invoice.date,
      reason: invoice.reason,
      dueDateAssumed: invoice.dueDate === null,
      total,
      paid,
      remaining,
    };
  });
}
