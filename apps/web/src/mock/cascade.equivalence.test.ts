// apps/web/src/mock/cascade.equivalence.test.ts
import { describe, it, expect } from "vitest";
import { recomputePeriod, type Mode } from "@cl/domain";
import { generatedSeed } from "./data.generated";
import { liveState, overlayDistribution, overlayUnits } from "./cascade";

const seed = generatedSeed;
const states = seed.periodStateByPeriod ?? {};
const bookPids = Object.keys(states).filter((pid) => states[pid]!.riparto.unitLegacyIds.length > 0);

describe("cascade on-load equivalence (generated seed)", () => {
  it("has book periods to check", () => {
    expect(bookPids.length).toBeGreaterThan(0);
  });

  it("derives distribution equal to the seeded DTO for every book period (both modes)", () => {
    for (const pid of bookPids) {
      const state = liveState(
        states[pid]!,
        seed.distributionTablesByPeriod[pid] ?? [],
        seed.ledgerAccountsByPeriod[pid] ?? [],
        states[pid]!.paid,
      );
      const eng = recomputePeriod(state).riparto;
      for (const mode of ["estimate", "current"] as Mode[]) {
        const got = overlayDistribution(eng, seed.distributionByPeriod[pid]![mode], mode);
        expect(got).toEqual(seed.distributionByPeriod[pid]![mode]);
      }
    }
  });

  it("derives units equal to the seeded DTO for every book period", () => {
    for (const pid of bookPids) {
      const state = liveState(
        states[pid]!,
        seed.distributionTablesByPeriod[pid] ?? [],
        seed.ledgerAccountsByPeriod[pid] ?? [],
        states[pid]!.paid,
      );
      const res = recomputePeriod(state);
      const got = overlayUnits(res.balances, seed.unitsByPeriod[pid] ?? [], seed.individualByPeriod?.[pid] ?? {});
      expect(got).toEqual(seed.unitsByPeriod[pid]);
    }
  });
});
