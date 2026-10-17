import type { Account } from "../entities/account.ts";
import { type Cents, cents, ZERO_CENTS } from "../entities/cents.ts";
import type {
  InvoiceTerms,
  InvoiceTotals,
  Rate,
  WithholdingTax,
} from "../entities/invoice.ts";
import type { Posting } from "../entities/journal.ts";
import { accepted, type ResultOf, rejected } from "../entities/result.ts";

/** An amount times a rate, rounded half up to the cent. Amounts and rates are never negative here. */
export function percentOf(amount: Cents, r: Rate): Cents {
  return cents(Math.round((amount * r) / 10000));
}

export function invoiceTotals(
  terms: InvoiceTerms,
  withholdingRate: Rate | null,
): InvoiceTotals {
  const socialSecurity = percentOf(terms.taxable, terms.socialSecurityRate);
  const invoiceTaxable = cents(terms.taxable + socialSecurity);
  const vat = percentOf(invoiceTaxable, terms.vatRate);
  const total = cents(invoiceTaxable + vat + terms.nonTaxable);
  const withholdingBase = terms.withholdingOnSocialSecurity
    ? invoiceTaxable
    : terms.taxable;

  const withholding =
    withholdingRate === null
      ? ZERO_CENTS
      : percentOf(withholdingBase, withholdingRate);

  return {
    socialSecurity,
    invoiceTaxable,
    vat,
    total,
    withholdingBase,
    withholding,
    dueToSupplier: cents(total - withholding),
  };
}

/** The cost debited, the supplier credited, and the tax account credited when something is withheld. */
export function invoicePostings(
  terms: InvoiceTerms,
  catalogue: WithholdingTax[],
  accounts: Account[],
): ResultOf<Posting[]> {
  const periodId = accounts.find((account) => {
    return account.id === terms.costAccountId;
  })?.periodId;

  const suppliers = accounts.find((account) => {
    return account.periodId === periodId && account.role === "suppliers";
  });

  if (suppliers === undefined) {
    return rejected("no-suppliers-account");
  }

  const tax =
    terms.withholdingCode === null
      ? null
      : catalogue.find((entry) => {
          return (
            entry.periodId === periodId && entry.code === terms.withholdingCode
          );
        });

  if (tax === undefined) {
    return rejected("unknown-withholding");
  }

  const totals = invoiceTotals(terms, tax === null ? null : tax.rate);
  const postings: Posting[] = [
    line(terms.costAccountId, totals.total, ZERO_CENTS, null),
    line(suppliers.id, ZERO_CENTS, totals.dueToSupplier, {
      kind: "supplier",
      id: terms.supplierId,
    }),
  ];

  if (tax !== null && totals.withholding !== 0) {
    postings.push(line(tax.accountId, ZERO_CENTS, totals.withholding, null));
  }

  return accepted(postings);
}

function line(
  accountId: string,
  debit: Cents,
  credit: Cents,
  counterpart: Posting["counterpart"],
): Posting {
  return { accountId, debit, credit, counterpart };
}
