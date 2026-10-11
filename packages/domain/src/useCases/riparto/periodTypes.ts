import type { RipartoEngine, RipartoInput } from "./types.ts";

/** Ordered installment plan + manual per-resident-per-installment overrides. */
export interface InstallmentPlan {
  /** Installment ids in due order (sorted by expiry upstream). */
  installmentIds: string[];
  /** Manual cell overrides. Each pins one resident's one installment to `cents`. */
  overrides: { residentId: string; installmentId: string; cents: number }[];
}

/** Clean, store/DB-agnostic input to the period cascade. All money is integer cents. */
export interface PeriodState {
  /** The shipped Phase 0 riparto input (drives buildRiparto). */
  riparto: RipartoInput;
  /** Installment plan for this period. */
  plan: InstallmentPlan;
  /** saldoPrec (opening balance) cents, per residentId. */
  opening: Record<string, number>;
  /** versato (paid-in) cents, per residentId. */
  paid: Record<string, number>;
}

/** Per-resident rolled-up balances. */
export interface ResidentBalance {
  residentId: string;
  preventivoCents: number; // Σ estimate share across all columns
  consuntivoCents: number; // Σ current share across all columns
  saldoPrecCents: number; // opening
  versatoCents: number; // paid
  totDovutoCents: number; // preventivo + saldoPrec − versato
}

/** Fully recomputed, conserved period result. */
export interface PeriodResult {
  /** The riparto query object (per-unit / per-resident, per mode). */
  riparto: RipartoEngine;
  /** Per-resident → per-installment cents (honouring valid overrides). */
  installments: Map<
    string /*residentId*/,
    Map<string /*installmentId*/, number>
  >;
  /** Per-resident rolled-up balances. */
  balances: ResidentBalance[];
}
