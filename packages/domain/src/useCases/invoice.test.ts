import { describe, expect, it } from "vitest";

import type { Account } from "../entities/account.ts";
import { cents } from "../entities/cents.ts";
import {
  type InvoiceTerms,
  rate,
  type WithholdingTax,
} from "../entities/invoice.ts";
import { invoicePostings, invoiceTotals, percentOf } from "./invoice.ts";

describe("rate", () => {
  it.each([-1, 2.5])("refuses %s", (value) => {
    expect(() => {
      return rate(value);
    }).toThrow("not a rate");
  });

  it("accepts zero", () => {
    expect(rate(0)).toBe(0);
  });
});

describe("invoiceTotals", () => {
  it("adds the social security to the taxable and withholds on it", () => {
    expect(
      invoiceTotals(
        createTerms({
          taxable: 18237,
          socialSecurityRate: 400,
          vatRate: 2000,
          withholdingOnSocialSecurity: true,
        }),
        rate(400),
      ),
    ).toEqual({
      socialSecurity: 729,
      invoiceTaxable: 18966,
      vat: 3793,
      total: 22759,
      withholdingBase: 18966,
      withholding: 759,
      dueToSupplier: 22000,
    });
  });

  it("withholds on the taxable alone when there is no social security", () => {
    const totals = invoiceTotals(
      createTerms({ taxable: 258805, vatRate: 2000 }),
      rate(400),
    );

    expect(totals.total).toBe(310566);
    expect(totals.withholding).toBe(10352);
    expect(totals.dueToSupplier).toBe(300214);
  });

  it("withholds on the taxable alone when the social security is left out", () => {
    const totals = invoiceTotals(
      createTerms({ taxable: 18237, socialSecurityRate: 400 }),
      rate(400),
    );

    expect(totals.withholdingBase).toBe(18237);
    expect(totals.withholding).toBe(729);
  });

  it("rounds half up at each step", () => {
    const totals = invoiceTotals(
      createTerms({ taxable: 30015, vatRate: 2000 }),
      rate(400),
    );

    expect(totals.vat).toBe(6003);
    expect(totals.total).toBe(36018);
    expect(totals.withholding).toBe(1201);
    expect(percentOf(cents(125), rate(200))).toBe(3);
  });

  it("withholds nothing without a rate", () => {
    const totals = invoiceTotals(
      createTerms({ taxable: 30015, vatRate: 2000 }),
      null,
    );

    expect(totals.withholding).toBe(0);
    expect(totals.dueToSupplier).toBe(totals.total);
  });

  it("adds the non-taxable amount to the total only", () => {
    const totals = invoiceTotals(
      createTerms({ taxable: 10000, nonTaxable: 500, vatRate: 2000 }),
      rate(400),
    );

    expect(totals.total).toBe(12500);
    expect(totals.withholding).toBe(400);
  });
});

describe("invoicePostings", () => {
  it("debits the cost, credits the supplier and the withholding account", () => {
    const result = invoicePostings(
      createTerms({ taxable: 30015, vatRate: 2000, withholdingCode: "1020" }),
      createCatalogue(),
      createChart(),
    );

    expect(result).toEqual({
      ok: true,
      value: [
        { accountId: "la200", debit: 36018, credit: 0, counterpart: null },
        {
          accountId: "la300",
          debit: 0,
          credit: 34817,
          counterpart: { kind: "supplier", id: "md78" },
        },
        { accountId: "la168", debit: 0, credit: 1201, counterpart: null },
      ],
    });
  });

  it("has no tax line without a withholding code", () => {
    const result = invoicePostings(
      createTerms({ taxable: 30015, vatRate: 2000 }),
      createCatalogue(),
      createChart(),
    );

    expect(result.ok && result.value).toHaveLength(2);
  });

  it("has no tax line when the withholding rounds to nothing", () => {
    const result = invoicePostings(
      createTerms({ taxable: 0, withholdingCode: "1020" }),
      createCatalogue(),
      createChart(),
    );

    expect(result.ok && result.value).toHaveLength(2);
  });

  it("is rejected for a code the period does not have", () => {
    expect(
      invoicePostings(
        createTerms({ withholdingCode: "9999" }),
        createCatalogue(),
        createChart(),
      ),
    ).toEqual({ ok: false, reason: "unknown-withholding" });
  });

  it("is rejected for a code of another period", () => {
    expect(
      invoicePostings(
        createTerms({ withholdingCode: "1020" }),
        createCatalogue().map((entry) => {
          return { ...entry, periodId: "p2" };
        }),
        createChart(),
      ),
    ).toEqual({ ok: false, reason: "unknown-withholding" });
  });

  it("is rejected when the period has no suppliers account", () => {
    expect(
      invoicePostings(
        createTerms({}),
        createCatalogue(),
        createChart().filter((account) => {
          return account.role !== "suppliers";
        }),
      ),
    ).toEqual({ ok: false, reason: "no-suppliers-account" });
  });
});

interface TermsOverrides {
  taxable?: number;
  socialSecurityRate?: number;
  vatRate?: number;
  nonTaxable?: number;
  withholdingCode?: string;
  withholdingOnSocialSecurity?: boolean;
}

function createTerms(overrides: TermsOverrides): InvoiceTerms {
  return {
    supplierId: "md78",
    number: "1",
    reason: "Lavori",
    date: "2013-03-01",
    dueDate: null,
    costAccountId: "la200",
    taxable: cents(overrides.taxable ?? 0),
    socialSecurityRate: rate(overrides.socialSecurityRate ?? 0),
    vatRate: rate(overrides.vatRate ?? 0),
    nonTaxable: cents(overrides.nonTaxable ?? 0),
    withholdingCode: overrides.withholdingCode ?? null,
    withholdingOnSocialSecurity: overrides.withholdingOnSocialSecurity ?? false,
  };
}

function createCatalogue(): WithholdingTax[] {
  return [
    {
      periodId: "p1",
      code: "1020",
      name: "Ritenuta",
      rate: rate(400),
      accountId: "la168",
    },
  ];
}

function createChart(): Account[] {
  return [
    createAccount("la200", "expenses", null),
    createAccount("la300", "liabilities", "suppliers"),
    createAccount("la168", "liabilities", "tax"),
  ];
}

function createAccount(
  id: string,
  nature: Account["nature"],
  role: Account["role"],
): Account {
  return {
    id,
    periodId: "p1",
    parentId: null,
    name: id,
    order: 1,
    nature,
    type: "regular",
    role,
    budget: null,
    abbreviation: null,
    links: [],
  };
}
