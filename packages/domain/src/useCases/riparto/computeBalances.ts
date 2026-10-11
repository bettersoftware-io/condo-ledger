import type { Mode, RipartoEngine } from "./types.ts";
import type { ResidentBalance } from "./periodTypes.ts";

/**
 * Sum each resident's share for a mode across every column and unit.
 * Mirrors apps/web/tools/gen/project/units.ts `sumByMode` so the generator's
 * unit balances stay byte-identical when it adopts recomputePeriod.
 */
export function perResidentTotals(eng: RipartoEngine, mode: Mode): Map<string, number> {
  const out = new Map<string, number>();
  for (const legacyUnitId of eng.unitLegacyIds) {
    for (const col of eng.columns) {
      const split = eng.perResidentAmount(col.legacyAccountId, mode, legacyUnitId);
      for (const [residentId, cents] of split) {
        out.set(residentId, (out.get(residentId) ?? 0) + cents);
      }
    }
  }
  return out;
}

/**
 * Per-resident rolled-up balances. Residents come from `roster` so zero-share
 * residents still appear. totDovuto = preventivo + saldoPrec − versato.
 *
 * Phase 1b note: the current generator (apps/web/tools/gen/project/units.ts) computes
 * totDovuto as saldoPrec + preventivo (it does NOT subtract versato), and folds
 * directly-attributed individual expenses into consuntivo. Those are adapter concerns
 * for when the generator adopts recomputePeriod — the parity guarantee here is scoped to
 * perResidentTotals mirroring the generator's sumByMode, not to totDovuto.
 */
export function computeBalances(
  roster: { residentId: string }[],
  eng: RipartoEngine,
  opening: Record<string, number>,
  paid: Record<string, number>,
): ResidentBalance[] {
  const preventivo = perResidentTotals(eng, "estimate");
  const consuntivo = perResidentTotals(eng, "current");
  const seen = new Set<string>();
  const balances: ResidentBalance[] = [];
  for (const { residentId } of roster) {
    if (seen.has(residentId)) continue;
    seen.add(residentId);
    const preventivoCents = preventivo.get(residentId) ?? 0;
    const consuntivoCents = consuntivo.get(residentId) ?? 0;
    const saldoPrecCents = opening[residentId] ?? 0;
    const versatoCents = paid[residentId] ?? 0;
    balances.push({
      residentId,
      preventivoCents,
      consuntivoCents,
      saldoPrecCents,
      versatoCents,
      totDovutoCents: preventivoCents + saldoPrecCents - versatoCents,
    });
  }
  return balances;
}
