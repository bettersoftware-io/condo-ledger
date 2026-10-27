import type { Account } from "#/entities/account.ts";
import type { Building } from "#/entities/building.ts";
import { cents } from "#/entities/cents.ts";
import type { Installment, InstallmentItem } from "#/entities/installment.ts";
import { type Invoice, rate, type WithholdingTax } from "#/entities/invoice.ts";
import type { Counterpart, JournalEntry } from "#/entities/journal.ts";
import type { OwnerParty, Party, SupplierParty } from "#/entities/party.ts";
import type { Coefficient, ThousandthTable } from "#/entities/table.ts";
import type { Unit, UnitGroup } from "#/entities/unit.ts";

/** What the simulators answer from: the legacy periods that have books, pseudonymised, as the generator emits them. */
export interface LegacySeed {
  buildings: Building[];
  accounts: Account[];
  entries: JournalEntry[];
  parties: PeriodParties[];
  invoices: Invoice[];
  withholdingTaxes: WithholdingTax[];
  /** Every seeded period's installment schedule. */
  installments: Installment[];
  /** What each resident owes on each installment; an item's period is its installment's. */
  installmentItems: InstallmentItem[];
  units: Unit[];
  unitGroups: UnitGroup[];
  /** Every seeded period's thousandth tables, each period's by their order. */
  tables: ThousandthTable[];
  /** Each table's coefficient for each unit; a coefficient's period is its table's. */
  coefficients: Coefficient[];
}

/** A period's parties: the building's suppliers and the residencies that overlap the period. */
interface PeriodParties {
  periodId: string;
  parties: Party[];
}

/** The same, as plain numbers: the shape of the generated module. */
export interface AccountData extends Omit<Account, "budget"> {
  budget: number | null;
}

export interface PostingData {
  accountId: string;
  debit: number;
  credit: number;
  counterpart: Counterpart | null;
  installmentItemId?: string;
}

export interface JournalEntryData extends Omit<JournalEntry, "postings"> {
  postings: PostingData[];
}

export interface InvoiceData
  extends Omit<
    Invoice,
    "taxable" | "nonTaxable" | "socialSecurityRate" | "vatRate"
  > {
  taxable: number;
  nonTaxable: number;
  socialSecurityRate: number;
  vatRate: number;
}

export interface WithholdingTaxData extends Omit<WithholdingTax, "rate"> {
  rate: number;
}

export interface InstallmentItemData extends Omit<InstallmentItem, "amount"> {
  amount: number;
}

interface OwnerPartyData extends Omit<OwnerParty, "startingBalance"> {
  startingBalance: number;
}

export type PartyData = SupplierParty | OwnerPartyData;

interface PeriodPartiesData {
  periodId: string;
  parties: PartyData[];
}

export interface LegacySeedData {
  buildings: Building[];
  accounts: AccountData[];
  entries: JournalEntryData[];
  parties: PeriodPartiesData[];
  invoices: InvoiceData[];
  withholdingTaxes: WithholdingTaxData[];
  installments: Installment[];
  installmentItems: InstallmentItemData[];
  units: Unit[];
  unitGroups: UnitGroup[];
  tables: ThousandthTable[];
  coefficients: Coefficient[];
}

/** Brands every amount. A fraction in the generated file fails here, once, instead of somewhere in a sum. */
export function loadLegacySeed(data: LegacySeedData): LegacySeed {
  return {
    buildings: data.buildings,
    accounts: data.accounts.map((account) => {
      return {
        ...account,
        budget: account.budget === null ? null : cents(account.budget),
      };
    }),
    entries: data.entries.map((entry) => {
      return {
        ...entry,
        postings: entry.postings.map((posting) => {
          return {
            ...posting,
            debit: cents(posting.debit),
            credit: cents(posting.credit),
          };
        }),
      };
    }),
    parties: data.parties.map((list) => {
      return { periodId: list.periodId, parties: list.parties.map(loadParty) };
    }),
    invoices: data.invoices.map((invoice) => {
      return {
        ...invoice,
        taxable: cents(invoice.taxable),
        nonTaxable: cents(invoice.nonTaxable),
        socialSecurityRate: rate(invoice.socialSecurityRate),
        vatRate: rate(invoice.vatRate),
      };
    }),
    withholdingTaxes: data.withholdingTaxes.map((tax) => {
      return { ...tax, rate: rate(tax.rate) };
    }),
    installments: data.installments,
    installmentItems: data.installmentItems.map((item) => {
      return { ...item, amount: cents(item.amount) };
    }),
    units: data.units,
    unitGroups: data.unitGroups,
    tables: data.tables,
    coefficients: data.coefficients,
  };
}

function loadParty(party: PartyData): Party {
  return party.kind === "supplier"
    ? party
    : { ...party, startingBalance: cents(party.startingBalance) };
}
