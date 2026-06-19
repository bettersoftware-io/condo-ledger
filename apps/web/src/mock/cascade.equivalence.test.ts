// apps/web/src/mock/cascade.equivalence.test.ts
import { describe, it, expect } from "vitest";
import type { Observable } from "rxjs";
import { recomputePeriod, type Mode } from "@cl/domain";
import { generatedSeed } from "./data.generated";
import { MockStore } from "./MockStore";
import { liveState, overlayDistribution, overlayUnits } from "./cascade";

const seed = generatedSeed;
const states = seed.periodStateByPeriod ?? {};
const bookPids = Object.keys(states).filter((pid) => states[pid]!.riparto.unitLegacyIds.length > 0);

const latest = <T,>(obs: Observable<T>): T => {
  let v!: T;
  obs.subscribe((x) => { v = x; }).unsubscribe();
  return v;
};

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

// On-load equivalence through the STORE for EVERY period (not just book periods). This
// exercises engineFor's guard + skeleton fallback — a structure-only period whose seeded
// state is empty but whose seeded unit DTO carries carried-forward money (e.g. p30's
// saldoPrec) must NOT be zeroed by the cascade. Going through MockStore catches that;
// the pure-helper gates above filter to book periods and would miss it.
describe("MockStore on-load equivalence (every period, generated seed)", () => {
  const store = new MockStore(generatedSeed);

  it("serves units identical to the seeded DTO for every period", () => {
    for (const pid of Object.keys(seed.unitsByPeriod)) {
      expect(latest(store.unitsTree(pid))).toEqual(seed.unitsByPeriod[pid]);
    }
  });

  it("serves distribution identical to the seeded DTO for every period and mode", () => {
    for (const pid of Object.keys(seed.distributionByPeriod)) {
      for (const mode of ["estimate", "current"] as Mode[]) {
        expect(latest(store.distribution(pid, mode))).toEqual(seed.distributionByPeriod[pid]![mode]);
      }
    }
  });
});
