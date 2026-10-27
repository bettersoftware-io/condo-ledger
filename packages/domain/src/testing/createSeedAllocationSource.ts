import { legacySeedData } from "../simulators/seed/legacySeed.generated.ts";
import { loadLegacySeed } from "../simulators/seed/legacySeed.ts";
import { must } from "../support/must.ts";
import type { AllocationSource } from "../useCases/allocation/allocation.ts";

/** One period of the committed seed, as the allocation reads it from the ports. */
export function createSeedAllocationSource(periodId: string): AllocationSource {
  const building = must(
    seed.buildings.find((candidate) => {
      return candidate.periods.some((period) => {
        return period.id === periodId;
      });
    }),
    `the building of ${periodId}`,
  );

  const period = must(
    building.periods.find((candidate) => {
      return candidate.id === periodId;
    }),
    `the period ${periodId}`,
  );

  return {
    periodLabel: `${building.name} ${period.name}`,
    period: { start: period.start, end: period.end },
    accounts: seed.accounts.filter((account) => {
      return account.periodId === periodId;
    }),
    parties: must(
      seed.parties.find((list) => {
        return list.periodId === periodId;
      }),
      `the parties of ${periodId}`,
    ).parties,
    entries: seed.entries.filter((entry) => {
      return entry.periodId === periodId;
    }),
    tables: seed.tables.filter((table) => {
      return table.periodId === periodId;
    }),
    coefficients: seed.coefficients.filter((coefficient) => {
      return seed.tables.some((table) => {
        return table.id === coefficient.tableId && table.periodId === periodId;
      });
    }),
    units: seed.units.filter((unit) => {
      return unit.periodId === periodId;
    }),
    groups: seed.unitGroups.filter((group) => {
      return group.periodId === periodId;
    }),
  };
}

const seed = loadLegacySeed(legacySeedData);
