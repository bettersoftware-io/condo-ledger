import {
  type AccountNode,
  buildAccountTree,
  type JournalEntry,
  loadLegacySeed,
} from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";

import { DEVIATIONS, renderOracleFixture } from "./designOracle.ts";

const PERIOD_ID = "p36";

/** Where the committed fixture is: the domain's testing/, which client-core's tests and the oracle check both reach. */
export const POZZETTO_FIXTURE_URL = new URL(
  "../../../domain/src/testing/pozzetto2013.oracle.ts",
  import.meta.url,
);

/** Pozzetto 2013 as the screens derive it from the committed seed: its chart of accounts and its entries. */
interface Pozzetto2013Books {
  tree: AccountNode;
  entries: JournalEntry[];
}

/**
 * The fixture module for Pozzetto 2013: its chart of accounts, derived from
 * the committed seed as the Accounts screen derives it, as keys and cents
 * only (no name leaves the seed), under a header that lists the deviations.
 */
export function renderPozzetto2013Fixture(): string {
  return renderOracleFixture(pozzetto2013Books().tree, DEVIATIONS);
}

/** The period's accounts, entries and parties, built into the tree the Accounts and Journal screens show. */
export function pozzetto2013Books(): Pozzetto2013Books {
  const seed = loadLegacySeed(legacySeedData);
  const entries = seed.entries.filter((entry) => {
    return entry.periodId === PERIOD_ID;
  });

  const tree = buildAccountTree(
    seed.accounts.filter((account) => {
      return account.periodId === PERIOD_ID;
    }),
    entries,
    seed.parties.find((list) => {
      return list.periodId === PERIOD_ID;
    })?.parties ?? [],
  );

  return { tree, entries };
}
