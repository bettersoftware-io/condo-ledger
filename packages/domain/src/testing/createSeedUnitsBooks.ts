import { addressTextOf } from "../entities/address.ts";
import { legacySeedData } from "../simulators/seed/legacySeed.generated.ts";
import { loadLegacySeed } from "../simulators/seed/legacySeed.ts";
import { must } from "../support/must.ts";
import { allocationBooksOf } from "../useCases/allocation/allocation.ts";
import { allocationSourceOf } from "../useCases/allocation/allocationSource.ts";
import type { UnitsBooks } from "../useCases/units/unitsList.ts";

/** One period of the committed seed, as the Units grid reads it: the root labelled "{building} / {period} ({address})". */
export function createSeedUnitsBooks(periodId: string): UnitsBooks {
  const source = allocationSourceOf(seed, periodId);
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

  const installments = seed.installments.filter((installment) => {
    return installment.periodId === periodId;
  });

  const installmentIds = new Set(
    installments.map((installment) => {
      return installment.id;
    }),
  );

  const address =
    building.address === null ? "" : ` (${addressTextOf(building.address)})`;

  return {
    allocation: allocationBooksOf(source),
    schedule: {
      periodLabel: source.periodLabel,
      period: source.period,
      accounts: source.accounts,
      parties: source.parties,
      entries: source.entries,
      installments,
      installmentItems: seed.installmentItems.filter((item) => {
        return installmentIds.has(item.installmentId);
      }),
    },
    units: source.units,
    groups: source.groups,
    buildingLabel: `${building.name} / ${period.name}${address}`,
  };
}

const seed = loadLegacySeed(legacySeedData);
