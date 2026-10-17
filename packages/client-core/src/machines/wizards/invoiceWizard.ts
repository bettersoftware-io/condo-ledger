import {
  type AccountNode,
  type Cents,
  type ClockPort,
  type EntryDraft,
  type Invoice,
  type InvoiceTerms,
  type InvoiceTotals,
  invoicePostings,
  invoiceTotals,
  type JournalEntry,
  ok,
  PATH_SEPARATOR,
  type Posting,
  paidOn,
  type Rate,
  type Result,
  rate,
  rejected,
  ZERO_CENTS,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { amountText, parseAmount, parseDate } from "#/amounts.ts";
import type { Books } from "#/presenters/booksPresenter.ts";
import { todayOf } from "#/today.ts";

import {
  contextOf,
  isExpenseLeaf,
  leafChoices,
  rowKeyOf,
  shortPath,
} from "./choices.ts";
import {
  createWizardMachine,
  type Derived,
  judged,
  refused,
  type WizardChoice,
  type WizardMachine,
  type WriteEntry,
} from "./wizard.ts";

/** The design's four pills: presets over the social security fields and the non-taxable amount. */
export type InvoicePreset =
  | "company"
  | "professionalWithRegister"
  | "professionalWithoutRegister"
  | "nonSubject";

/** What the person types for an invoice: amounts, rates and dates as text, read in core. */
export interface InvoiceForm {
  supplierId: string | null;
  number: string;
  reason: string;
  /** `23/4/2013`, `23/04/2013` or `23/4`, in the period's year. */
  date: string;
  /** As the date, or blank for none. */
  dueDate: string;
  costAccountId: string | null;
  taxable: string;
  /** A percentage: `4` is 4%. */
  socialSecurityRate: string;
  vatRate: string;
  /** Blank is nothing. */
  nonTaxable: string;
  /** A code of the period's catalogue, or none. */
  withholdingCode: string | null;
  withholdingOnSocialSecurity: boolean;
  description: string;
  preset: InvoicePreset;
  /** The fields the person changed: the prefill and the generated description leave them alone. */
  edited: string[];
}

/** What the invoice wizard shows beyond the contract. */
export interface InvoiceSummary {
  /** Step 2's computed rows; null while an amount, a rate or the code cannot be read. */
  totals: InvoiceTotals | null;
  /** An edited invoice that a payment names: its supplier cannot change. */
  supplierLocked: boolean;
  /** What the edited invoice's payments have paid; 0 for a new one. */
  paid: Cents;
  /** The supplier already has an invoice with this number in the period: a warning, not a refusal. */
  duplicate: boolean;
  nonTaxableShown: boolean;
}

/** The group of the choices that are the period's suppliers. */
export const SUPPLIER_GROUP = "Suppliers";

/** The group of the choices that are the period's withholding codes. */
export const WITHHOLDING_GROUP = "Withholding taxes";

/** What a supplier with no earlier invoice in the period starts with. */
const DEFAULTS: Prefilled = {
  costAccountId: null,
  socialSecurityRate: "0",
  vatRate: "20",
  withholdingCode: null,
  withholdingOnSocialSecurity: false,
  reason: "",
};

/** The fields choosing a supplier copies from its last invoice. */
interface Prefilled {
  costAccountId: string | null;
  socialSecurityRate: string;
  vatRate: string;
  withholdingCode: string | null;
  withholdingOnSocialSecurity: boolean;
  reason: string;
}

/** The fields a pill sets; With non-subject amounts sets none. */
interface PresetFields {
  socialSecurityRate: string;
  withholdingOnSocialSecurity: boolean;
  nonTaxable: string;
}

const PRESETS: Record<InvoicePreset, PresetFields | null> = {
  company: {
    socialSecurityRate: "0",
    withholdingOnSocialSecurity: false,
    nonTaxable: "0",
  },
  professionalWithRegister: {
    socialSecurityRate: "4",
    withholdingOnSocialSecurity: true,
    nonTaxable: "0",
  },
  professionalWithoutRegister: {
    socialSecurityRate: "0",
    withholdingOnSocialSecurity: false,
    nonTaxable: "0",
  },
  nonSubject: null,
};

/** Every field of the form the person can change: an edited invoice's are all the person's already. */
const FIELDS: readonly (keyof InvoiceForm)[] = [
  "supplierId",
  "number",
  "reason",
  "date",
  "dueDate",
  "costAccountId",
  "taxable",
  "socialSecurityRate",
  "vatRate",
  "nonTaxable",
  "withholdingCode",
  "withholdingOnSocialSecurity",
  "description",
  "preset",
];

/** What the wizard reads the form against. */
interface InvoiceBooks {
  books: Books | null;
  /** The period's year: a date typed without one is in it. */
  year: number;
  suppliers: WizardChoice[];
  costAccounts: WizardChoice[];
  /** The invoice the wizard rewrites; null for a new one. */
  edited: Invoice | null;
}

/** The amounts and rates of step 2, read. */
interface InvoiceAmounts {
  taxable: Cents;
  nonTaxable: Cents;
  socialSecurityRate: Rate;
  vatRate: Rate;
}

/**
 * The New invoice wizard: step 1 "Select supplier", step 2 "Calculate
 * withholding". Choosing a supplier copies its most recent invoice of the
 * period into the fields the person has not changed. Editing, the form is the
 * invoice's terms and the entry's description, every field the person's, and
 * the supplier stays put while a payment names the invoice.
 */
export function createInvoiceWizard(
  books: Books | null,
  clock: ClockPort,
  write: WriteEntry,
  editing: JournalEntry | null,
): WizardMachine<InvoiceForm, InvoiceSummary> {
  const opened =
    editing === null
      ? null
      : openedOf(must(books, "the books of the edited entry"), editing);

  const replacing = editing?.id ?? null;
  const read: InvoiceBooks = {
    books,
    year: books === null ? 0 : Number(books.period.start.slice(0, 4)),
    suppliers: books === null ? [] : supplierChoices(books),
    costAccounts: books === null ? [] : leafChoices(books, isExpenseLeaf),
    edited: opened?.invoice ?? null,
  };

  const supplierLocked = opened?.locked ?? false;

  function derived(form: InvoiceForm): Derived {
    return derive(read, form, replacing);
  }

  const machine = createWizardMachine<InvoiceForm, InvoiceSummary>(
    {
      initial: opened?.form ?? emptyForm(books, clock),
      stepCount: 2,
      choices: [
        ...read.suppliers,
        ...read.costAccounts,
        ...(books === null ? [] : withholdingChoices(books)),
      ],
      derive: derived,
      summarize: (form: InvoiceForm): InvoiceSummary => {
        return {
          totals: totalsOf(books, form),
          supplierLocked,
          paid: opened?.paid ?? ZERO_CENTS,
          duplicate: isDuplicate(read, form),
          nonTaxableShown: form.preset === "nonSubject",
        };
      },
      stepVerdict: (form: InvoiceForm, step: number): Result => {
        if (step === 1) {
          const reason = stepOneReason(read, form);

          return reason === null ? ok() : rejected(reason);
        }

        return derived(form).verdict;
      },
      editing: replacing,
    },
    write,
  );

  function edit(patch: Partial<InvoiceForm>): void {
    const { supplierId, ...rest } = patch;
    const allowed = supplierLocked || supplierId === undefined ? rest : patch;

    machine.intents.edit(
      applied(read, machine.state$.getValue().form, allowed),
    );
  }

  return { ...machine, intents: { ...machine.intents, edit } };
}

/** An invoice opened for an edit: the form it was written from, what its payments paid, and whether one names it. */
interface OpenedInvoice {
  invoice: Invoice;
  form: InvoiceForm;
  paid: Cents;
  locked: boolean;
}

function openedOf(books: Books, entry: JournalEntry): OpenedInvoice {
  const invoice = must(
    books.invoices.find((candidate) => {
      return candidate.entryId === entry.id;
    }),
    `the invoice of the entry ${entry.id}`,
  );

  return {
    invoice,
    form: formOf(invoice, entry),
    paid: paidOn(invoice.id, books.entries),
    locked: books.entries.some((candidate) => {
      return (
        candidate.kind === "invoicePayment" &&
        candidate.invoiceId === invoice.id
      );
    }),
  };
}

/** The form after the person's patch: the fields it names are theirs from now on; a new supplier prefills the others; a pill sets its fields; the description follows until it is edited. */
function applied(
  read: InvoiceBooks,
  form: InvoiceForm,
  patch: Partial<InvoiceForm>,
): InvoiceForm {
  const named = FIELDS.filter((field) => {
    return field in patch;
  });
  const fromPreset = patch.preset === undefined ? null : PRESETS[patch.preset];
  let next: InvoiceForm = {
    ...form,
    ...patch,
    ...fromPreset,
    edited: union(form.edited, [
      ...named,
      ...(fromPreset === null ? [] : Object.keys(fromPreset)),
    ]),
  };

  if (patch.supplierId !== undefined && patch.supplierId !== form.supplierId) {
    next = prefilled(read.books, next);
  }

  if (!next.edited.includes("description")) {
    next = { ...next, description: describe(read, next) };
  }

  return next;
}

/** The fields the person has not changed, from the supplier's most recent invoice of the period or the defaults; and the pill that matches them, unless the person picked one. */
function prefilled(books: Books | null, form: InvoiceForm): InvoiceForm {
  const last = lastInvoice(books?.invoices ?? [], form.supplierId);
  const source = last === null ? DEFAULTS : prefillOf(last);
  const next: InvoiceForm = { ...form };

  for (const [field, value] of Object.entries(source)) {
    if (!form.edited.includes(field)) {
      Object.assign(next, { [field]: value });
    }
  }

  return form.edited.includes("preset")
    ? next
    : { ...next, preset: presetOf(next) };
}

/** The supplier's invoice of the period latest by date, then by number. */
function lastInvoice(
  invoices: Invoice[],
  supplierId: string | null,
): Invoice | null {
  return (
    invoices
      .filter((invoice) => {
        return invoice.supplierId === supplierId;
      })
      .sort((a, b) => {
        return (
          a.date.localeCompare(b.date) ||
          a.number.localeCompare(b.number, "en", { numeric: true })
        );
      })
      .at(-1) ?? null
  );
}

function prefillOf(invoice: Invoice): Prefilled {
  return {
    costAccountId: invoice.costAccountId,
    socialSecurityRate: rateText(invoice.socialSecurityRate),
    vatRate: rateText(invoice.vatRate),
    withholdingCode: invoice.withholdingCode,
    withholdingOnSocialSecurity: invoice.withholdingOnSocialSecurity,
    reason: invoice.reason,
  };
}

/** The pill the fields match: a non-taxable amount is With non-subject amounts; no social security is Company (the flag has nothing to apply to); 4% on social security is Professional w/ register; anything else keeps the fields as they are. */
function presetOf(form: InvoiceForm): InvoicePreset {
  const nonTaxable = optionalAmount(form.nonTaxable);
  const socialSecurity = parseRate(form.socialSecurityRate);

  if (nonTaxable !== null && nonTaxable !== ZERO_CENTS) {
    return "nonSubject";
  }

  if (socialSecurity === 0) {
    return "company";
  }

  return socialSecurity === 400 && form.withholdingOnSocialSecurity
    ? "professionalWithRegister"
    : "nonSubject";
}

/** "Invoice {number} — {supplier}: {reason}" once there is a number and a supplier; blank before. */
function describe(read: InvoiceBooks, form: InvoiceForm): string {
  const supplier = read.suppliers.find((choice) => {
    return choice.key === form.supplierId;
  });
  const number = form.number.trim();

  return supplier === undefined || number === ""
    ? ""
    : `Invoice ${number} — ${supplier.label}: ${form.reason.trim()}`;
}

function emptyForm(books: Books | null, clock: ClockPort): InvoiceForm {
  return {
    supplierId: null,
    number: "",
    reason: "",
    date: books === null ? "" : dateText(startingDate(books, clock)),
    dueDate: "",
    costAccountId: null,
    taxable: "",
    socialSecurityRate: DEFAULTS.socialSecurityRate,
    vatRate: DEFAULTS.vatRate,
    nonTaxable: "0",
    withholdingCode: null,
    withholdingOnSocialSecurity: false,
    description: "",
    preset: "company",
    edited: [],
  };
}

/** Today when it lies inside the period, otherwise the period's last day. */
function startingDate(books: Books, clock: ClockPort): string {
  const today = todayOf(clock);
  const { start, end } = books.period;

  return today >= start && today <= end ? today : end;
}

/** The form an invoice was written from: its terms as text, and its entry's description. */
function formOf(invoice: Invoice, entry: JournalEntry): InvoiceForm {
  const form: InvoiceForm = {
    supplierId: invoice.supplierId,
    number: invoice.number,
    reason: invoice.reason,
    date: dateText(invoice.date),
    dueDate: invoice.dueDate === null ? "" : dateText(invoice.dueDate),
    costAccountId: invoice.costAccountId,
    taxable: amountText(invoice.taxable),
    socialSecurityRate: rateText(invoice.socialSecurityRate),
    vatRate: rateText(invoice.vatRate),
    nonTaxable: amountText(invoice.nonTaxable),
    withholdingCode: invoice.withholdingCode,
    withholdingOnSocialSecurity: invoice.withholdingOnSocialSecurity,
    description: entry.description,
    preset: "company",
    edited: [...FIELDS],
  };

  return { ...form, preset: presetOf(form) };
}

function derive(
  read: InvoiceBooks,
  form: InvoiceForm,
  replacing: string | null,
): Derived {
  const stepOne = stepOneReason(read, form);

  if (stepOne !== null) {
    return refused(stepOne);
  }

  // A supplier was offered: there are books.
  const books = must(read.books, "the books");

  const amounts = amountsOf(form);

  if (typeof amounts === "string") {
    return refused(amounts);
  }

  const terms = termsOf(read, form, amounts);
  const postings = invoicePostings(
    terms,
    books.withholdingTaxes,
    books.accounts,
  );

  if (!postings.ok) {
    return refused(postings.reason);
  }

  const draft: EntryDraft = {
    kind: "invoice",
    description: form.description,
    postings: postings.value,
    invoice: terms,
  };

  const preview = postings.value.map((posting) => {
    return {
      path: pathOf(books, posting),
      debit: posting.debit,
      credit: posting.credit,
    };
  });

  return judged(preview, draft, contextOf(books, replacing));
}

/** Step 1's rules, in order: the supplier, the number, the reason, the cost account, the dates. */
function stepOneReason(read: InvoiceBooks, form: InvoiceForm): string | null {
  if (!offers(read.suppliers, form.supplierId)) {
    return "no-supplier";
  }

  if (form.number.trim() === "") {
    return "no-number";
  }

  if (form.reason.trim() === "") {
    return "no-reason";
  }

  if (!offers(read.costAccounts, form.costAccountId)) {
    return "no-cost-account";
  }

  const date = parseDate(form.date, read.year);
  const dueDate = optionalDate(form.dueDate, read.year);

  if (date === null || dueDate === undefined) {
    return "not-a-date";
  }

  return dueDate !== null && dueDate < date ? "due-before-date" : null;
}

/** Step 2's amounts, then its rates; the first that cannot be read names its reason. */
function amountsOf(form: InvoiceForm): InvoiceAmounts | string {
  const taxable = parseAmount(form.taxable);
  const nonTaxable = optionalAmount(form.nonTaxable);

  if (taxable === null || taxable < 0 || nonTaxable === null) {
    return "not-an-amount";
  }

  const socialSecurityRate = parseRate(form.socialSecurityRate);
  const vatRate = parseRate(form.vatRate);

  if (socialSecurityRate === null || vatRate === null) {
    return "not-a-rate";
  }

  return { taxable, nonTaxable, socialSecurityRate, vatRate };
}

/** The terms of a form whose steps both pass. */
function termsOf(
  read: InvoiceBooks,
  form: InvoiceForm,
  amounts: InvoiceAmounts,
): InvoiceTerms {
  return {
    supplierId: must(form.supplierId, "the supplier"),
    number: form.number.trim(),
    reason: form.reason.trim(),
    date: must(parseDate(form.date, read.year), "the date"),
    dueDate: optionalDate(form.dueDate, read.year) ?? null,
    costAccountId: must(form.costAccountId, "the cost account"),
    ...amounts,
    withholdingCode: form.withholdingCode,
    withholdingOnSocialSecurity: form.withholdingOnSocialSecurity,
  };
}

/** Step 2's computed rows, once the amounts, the rates and the code can be read. */
function totalsOf(
  books: Books | null,
  form: InvoiceForm,
): InvoiceTotals | null {
  const amounts = amountsOf(form);
  const code = form.withholdingCode;
  const tax =
    code === null
      ? null
      : books?.withholdingTaxes.find((candidate) => {
          return candidate.code === code;
        });

  if (typeof amounts === "string" || tax === undefined) {
    return null;
  }

  return invoiceTotals(
    {
      supplierId: "",
      number: "",
      reason: "",
      date: "",
      dueDate: null,
      costAccountId: "",
      ...amounts,
      withholdingCode: code,
      withholdingOnSocialSecurity: form.withholdingOnSocialSecurity,
    },
    tax === null ? null : tax.rate,
  );
}

/** Whether another invoice of the period has this supplier and this number. */
function isDuplicate(read: InvoiceBooks, form: InvoiceForm): boolean {
  const number = form.number.trim();

  return (read.books?.invoices ?? []).some((invoice) => {
    return (
      invoice.id !== read.edited?.id &&
      invoice.supplierId === form.supplierId &&
      invoice.number === number
    );
  });
}

/** The period's suppliers, by name. */
function supplierChoices(books: Books): WizardChoice[] {
  return books.parties
    .filter((party) => {
      return party.kind === "supplier";
    })
    .map((party) => {
      return { key: party.id, label: party.name, group: SUPPLIER_GROUP };
    })
    .sort((a, b) => {
      return a.label.localeCompare(b.label);
    });
}

/** The period's withholding codes, by code. */
function withholdingChoices(books: Books): WizardChoice[] {
  return books.withholdingTaxes
    .map((tax) => {
      return {
        key: tax.code,
        label: `${tax.code} — ${tax.name}`,
        group: WITHHOLDING_GROUP,
      };
    })
    .sort((a, b) => {
      return a.key.localeCompare(b.key);
    });
}

/** A posting as the preview shows it: the path of the row it lands on; for a supplier with no row yet, its account's path and its name. */
function pathOf(books: Books, posting: Posting): string {
  const row = rowKeyOf(books, posting);

  if (row !== null) {
    return shortPath(books, row);
  }

  const supplier = must(
    books.parties.find((party) => {
      return party.id === posting.counterpart?.id;
    }),
    `the supplier of a posting on ${posting.accountId}`,
  );

  const account = must(
    keyOfAccount(books.tree, posting.accountId),
    `the node of ${posting.accountId}`,
  );

  return `${shortPath(books, account)}${PATH_SEPARATOR}${supplier.name}`;
}

/** The key of the first node of the account, in tree order: a control account's own node, on its first side. */
function keyOfAccount(node: AccountNode, accountId: string): string | null {
  if (node.accountId === accountId) {
    return node.key;
  }

  for (const child of node.children) {
    const key = keyOfAccount(child, accountId);

    if (key !== null) {
      return key;
    }
  }

  return null;
}

function offers(choices: WizardChoice[], key: string | null): boolean {
  return choices.some((choice) => {
    return choice.key === key;
  });
}

/** A rate typed as a percentage, `4` or `21.5`, in hundredths of a percent; a negative one, or anything else, is null. */
function parseRate(text: string): Rate | null {
  const value = parseAmount(text);

  return value === null || value < 0 ? null : rate(value);
}

/** A rate as the form holds it: `2000` is `20`, `2150` is `21.5`. */
function rateText(value: Rate): string {
  return String(value / 100);
}

/** A non-negative amount, blank being nothing; null when it cannot be read. */
function optionalAmount(text: string): Cents | null {
  if (text.trim() === "") {
    return ZERO_CENTS;
  }

  const value = parseAmount(text);

  return value === null || value < 0 ? null : value;
}

/** A date that may be blank: null when it is, undefined when it cannot be read. */
function optionalDate(text: string, year: number): string | null | undefined {
  return text.trim() === "" ? null : (parseDate(text, year) ?? undefined);
}

/** `2013-04-23` as `23/04/2013`, a text parseDate reads back. */
function dateText(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function union(names: string[], more: string[]): string[] {
  return [...new Set([...names, ...more])];
}
