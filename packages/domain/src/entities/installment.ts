import type { Cents } from "./cents.ts";

/** One installment of a period's schedule: "Rata 1", due on a date. */
export interface Installment {
  id: string;
  periodId: string;
  /** 1-based, by due date. */
  number: number;
  name: string;
  /** "YYYY-MM-DD". */
  dueDate: string;
}

/** What one resident owes on one installment. */
export interface InstallmentItem {
  id: string;
  installmentId: string;
  /** An OwnerParty id of the period. */
  residentId: string;
  /** Never negative; zero items exist. */
  amount: Cents;
}
