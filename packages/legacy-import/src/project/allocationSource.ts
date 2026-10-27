import type { AllocationSource, LegacySeed } from "@cl/domain";

/** One period of the projected seed, as the allocation reads it from the ports. */
export function allocationSourceOf(
  seed: LegacySeed,
  periodId: string,
): AllocationSource {
  const building = seed.buildings.find((candidate) => {
    return candidate.periods.some((period) => {
      return period.id === periodId;
    });
  });

  const period = building?.periods.find((candidate) => {
    return candidate.id === periodId;
  });

  const parties = seed.parties.find((list) => {
    return list.periodId === periodId;
  });

  if (building === undefined || period === undefined || parties === undefined) {
    throw new Error(`The projected seed has no books for period ${periodId}`);
  }

  const tableIds = new Set(
    seed.tables
      .filter((table) => {
        return table.periodId === periodId;
      })
      .map((table) => {
        return table.id;
      }),
  );

  return {
    periodLabel: `${building.name} ${period.name}`,
    period: { start: period.start, end: period.end },
    accounts: seed.accounts.filter((account) => {
      return account.periodId === periodId;
    }),
    parties: parties.parties,
    entries: seed.entries.filter((entry) => {
      return entry.periodId === periodId;
    }),
    tables: seed.tables.filter((table) => {
      return table.periodId === periodId;
    }),
    coefficients: seed.coefficients.filter((coefficient) => {
      return tableIds.has(coefficient.tableId);
    }),
    units: seed.units.filter((unit) => {
      return unit.periodId === periodId;
    }),
    groups: seed.unitGroups.filter((group) => {
      return group.periodId === periodId;
    }),
  };
}
