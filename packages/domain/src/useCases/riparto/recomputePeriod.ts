import { computeBalances, perResidentTotals } from "./computeBalances.ts";
import { computeInstallments } from "./computeInstallments.ts";
import { buildRiparto } from "./computeRiparto.ts";
import type { PeriodResult, PeriodState } from "./periodTypes.ts";

/**
 * Pure period cascade. Depends only on `state`. Integer cents throughout.
 * riparto (buildRiparto) → per-resident estimate totals → installments + balances.
 * Installments derive from the SAME per-resident estimate the balances use, so
 * Σ installment cells == resident preventivo by construction.
 */
export function recomputePeriod(state: PeriodState): PeriodResult {
  const riparto = buildRiparto(state.riparto);
  const estimateByResident = perResidentTotals(riparto, "estimate");
  const installments = computeInstallments(estimateByResident, state.plan);
  const balances = computeBalances(
    state.riparto.residents,
    riparto,
    state.opening,
    state.paid,
  );
  return { riparto, installments, balances };
}
