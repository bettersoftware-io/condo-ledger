import type { Cents } from "./cents.ts";

/** A percentage in hundredths of a percent: 400 is 4%, 2000 is 20%. */
export type Rate = number & { readonly __brand: "Rate" };

export function rate(hundredthsOfAPercent: number): Rate {
  if (!Number.isInteger(hundredthsOfAPercent) || hundredthsOfAPercent < 0) {
    throw new Error(`not a rate: ${hundredthsOfAPercent}`);
  }

  return hundredthsOfAPercent as Rate;
}

/** One withholding tax of a period's catalogue; its account takes the amount withheld. */
export interface WithholdingTax {
  periodId: string;
  code: string;
  name: string;
  rate: Rate;
  accountId: string;
}

/** What the person types for an invoice. Dates are "YYYY-MM-DD". */
export interface InvoiceTerms {
  supplierId: string;
  number: string;
  reason: string;
  date: string;
  dueDate: string | null;
  costAccountId: string;
  taxable: Cents;
  socialSecurityRate: Rate;
  vatRate: Rate;
  nonTaxable: Cents;
  withholdingCode: string | null;
  withholdingOnSocialSecurity: boolean;
}

/** Every amount an invoice's terms imply, rounded half up to the cent at each step. */
export interface InvoiceTotals {
  socialSecurity: Cents;
  invoiceTaxable: Cents;
  vat: Cents;
  total: Cents;
  withholdingBase: Cents;
  withholding: Cents;
  dueToSupplier: Cents;
}
