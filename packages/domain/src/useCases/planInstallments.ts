import type { Account } from "../entities/account.ts";
import { type Cents, cents } from "../entities/cents.ts";
import type { InstallmentItem } from "../entities/installment.ts";
import type { JournalEntry } from "../entities/journal.ts";
import type { Party } from "../entities/party.ts";
import { must } from "../support/must.ts";
import { budgetSharesOf, previousBalancesOf } from "./budgetShares.ts";

/** One installment of a batch about to be created. */
export interface PlannedInstallment {
  name: string;
  /** "YYYY-MM-DD". */
  dueDate: string;
  /** Of the budget part, in hundredths of a percent: 3333 is 33.33%. */
  percentage: number;
}

/** A batch as the person asks for it: the installments, and how to round. */
interface PlanBatch {
  installments: PlannedInstallment[];
  /** Items 2…n rounded to whole euros, item 1 taking the rest. */
  wholeEuros: boolean;
}

/** One period's books, as much of them as a plan reads. */
export interface PlanBooks {
  accounts: Account[];
  parties: Party[];
  entries: JournalEntry[];
  /** The period's items already scheduled. */
  installmentItems: InstallmentItem[];
}

/** What the legacy "Crea Rate Preventivo" generator read. */
export interface PlanInput extends PlanBatch {
  /** Every owner of the period, in the order the plan lists them. */
  residents: string[];
  /** By resident: Total budget, the budget allocation entry's share. */
  shares: Map<string, Cents>;
  /** By resident: Prev. bal. */
  previousBalances: Map<string, Cents>;
  /** The period's items already scheduled. */
  existingItems: InstallmentItem[];
}

/** One resident's amount on one installment of the batch. */
export interface PlannedItem {
  /** Into `PlanInput.installments`. */
  installmentIndex: number;
  residentId: string;
  amount: Cents;
}

const CENTS_PER_EURO = 100;
const WHOLE = 10_000;

/**
 * Each resident's items on a batch of budget installments, as the legacy
 * generator made them (`InstallmentVO.as:383-447`,
 * `InstallmentGroupVO.as:212-330`). Listed by resident, then installment.
 */
export function planBudgetInstallments(input: PlanInput): PlannedItem[] {
  if (input.installments.length === 0) {
    return [];
  }

  const firstBatch = input.existingItems.length === 0;
  const percentages = input.installments.map((installment) => {
    return installment.percentage;
  });

  return input.residents.flatMap((residentId) => {
    const previous = input.previousBalances.get(residentId) ?? 0;
    const prevPart = firstBatch ? previous : 0;
    const budgetPart =
      previous +
      (input.shares.get(residentId) ?? 0) -
      scheduled(input.existingItems, residentId) -
      prevPart;
    const amounts = split(budgetPart, percentages, input.wholeEuros);

    amounts[0] = must(amounts[0], "item 1") + prevPart;

    return carryNegatives(amounts).map((amount, installmentIndex) => {
      return { installmentIndex, residentId, amount: cents(amount) };
    });
  });
}

/**
 * What a batch is planned from in a period's books: every owner as a
 * resident, in the parties' order; the budget allocation entry's shares; the
 * previous balances; and the items already scheduled. The port that saves a
 * batch and the screen that reviews it both plan from this, so the review
 * shows what is saved.
 */
export function planInputOf(batch: PlanBatch, books: PlanBooks): PlanInput {
  return {
    installments: batch.installments,
    wholeEuros: batch.wholeEuros,
    residents: books.parties
      .filter((party) => {
        return party.kind === "owner";
      })
      .map((party) => {
        return party.id;
      }),
    shares: budgetSharesOf(books.entries, books.accounts).shares,
    previousBalances: previousBalancesOf(
      books.entries,
      books.accounts,
      books.parties,
    ),
    existingItems: books.installmentItems,
  };
}

/** `floor(100 / count)` percent each, the first taking the rest, in hundredths of a percent. */
export function defaultPercentages(count: number): number[] {
  const each = Math.floor(100 / count);

  return Array.from({ length: count }, (_, index) => {
    return (index === 0 ? 100 - each * (count - 1) : each) * 100;
  });
}

/** `count` dates `months` apart from `first`, the day clamped to each month's last. */
export function dueDates(
  first: string,
  count: number,
  months: number,
): string[] {
  const [year, month, day] = must(
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(first),
    `a date: ${first}`,
  )
    .slice(1)
    .map(Number);
  const start = must(year, "year") * 12 + must(month, "month") - 1;

  return Array.from({ length: count }, (_, index) => {
    const at = start + index * months;
    const atYear = Math.floor(at / 12);
    const atMonth = (at % 12) + 1;
    const atDay = Math.min(must(day, "day"), daysIn(atYear, atMonth));

    return `${atYear}-${pad(atMonth)}-${pad(atDay)}`;
  });
}

function scheduled(items: InstallmentItem[], residentId: string): number {
  return items
    .filter((item) => {
      return item.residentId === residentId;
    })
    .reduce((total, item) => {
      return total + item.amount;
    }, 0);
}

/** The budget part by percentage: each to the cent, or items 2…n to whole euros and item 1 the rest. */
function split(
  budgetPart: number,
  percentages: number[],
  wholeEuros: boolean,
): number[] {
  if (!wholeEuros) {
    return percentages.map((percentage) => {
      return divideRounded(budgetPart * percentage, WHOLE);
    });
  }

  const rest = percentages.slice(1).map((percentage) => {
    return (
      divideRounded(budgetPart * percentage, WHOLE * CENTS_PER_EURO) *
      CENTS_PER_EURO
    );
  });

  const others = rest.reduce((total, amount) => {
    return total + amount;
  }, 0);

  return [budgetPart - others, ...rest];
}

/**
 * Walking first to last, a negative item becomes 0 and its amount goes into
 * the next; what is left after the last walks back the same way; a credit
 * still left is dropped, every item then 0.
 */
function carryNegatives(amounts: number[]): number[] {
  const result = [...amounts];
  const forward = result.map((_, index) => {
    return index;
  });
  const left = carryAlong(result, forward, 0);

  carryAlong(result, forward.reverse(), left);

  return result;
}

/** Carries `carry` (zero or negative) along `order`, and returns what is left. */
function carryAlong(amounts: number[], order: number[], carry: number): number {
  let difference = carry;

  for (const index of order) {
    const amount = must(amounts[index], `item ${index + 1}`) + difference;

    difference = Math.min(amount, 0);
    amounts[index] = Math.max(amount, 0);
  }

  return difference;
}

/**
 * `numerator / denominator` (denominator > 0) to the nearest integer, a half
 * toward +∞ (2.5 → 3, −2.5 → −2), as the legacy app's `Math.round`; integers
 * only. Never −0: the floor's argument is −0 only for a numerator of −d/2,
 * and 2·(−d/2) + d is +0.
 */
function divideRounded(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

function daysIn(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

    return leap ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
