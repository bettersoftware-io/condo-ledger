import type { OwnerParty, Party, SupplierParty } from "#/entities/party.ts";

import type { LegacySeed } from "./seed/legacySeed.ts";

/** The seed's suppliers of one period: every simulator reads them from the seed. */
export function seededSuppliers(
  seed: LegacySeed,
  periodId: string,
): SupplierParty[] {
  return partiesOf(seed, periodId).filter((party) => {
    return party.kind === "supplier";
  });
}

/** The seed's residents of one period: what a simulator reads when no units simulator is wired in. */
export function seededResidents(
  seed: LegacySeed,
  periodId: string,
): OwnerParty[] {
  return partiesOf(seed, periodId).filter((party) => {
    return party.kind === "owner";
  });
}

function partiesOf(seed: LegacySeed, periodId: string): Party[] {
  return (
    seed.parties.find((list) => {
      return list.periodId === periodId;
    })?.parties ?? []
  );
}
