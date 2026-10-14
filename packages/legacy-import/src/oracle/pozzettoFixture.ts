import { buildAccountTree, loadLegacySeed } from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";

import { DEVIATIONS, renderOracleFixture } from "./designOracle.ts";

const PERIOD_ID = "p36";

/** Where the committed fixture is: the domain's testing/, which client-core's tests and the oracle check both reach. */
export const POZZETTO_FIXTURE_URL = new URL(
  "../../../domain/src/testing/pozzetto2013.oracle.ts",
  import.meta.url,
);

/**
 * The fixture module for Pozzetto 2013: its chart of accounts, derived from
 * the committed seed as the Accounts screen derives it, as keys and cents
 * only (no name leaves the seed), under a header that lists the deviations.
 */
export function renderPozzetto2013Fixture(): string {
  const seed = loadLegacySeed(legacySeedData);
  const tree = buildAccountTree(
    seed.accounts.filter((account) => {
      return account.periodId === PERIOD_ID;
    }),
    seed.entries.filter((entry) => {
      return entry.periodId === PERIOD_ID;
    }),
    seed.parties,
  );

  return renderOracleFixture(tree, DEVIATIONS);
}
