import { writeFileSync } from "node:fs";

import { buildAccountTree, loadLegacySeed } from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";

import { DEVIATIONS, renderOracleFixture } from "./designOracle.ts";

const PERIOD_ID = "p36";
const FIXTURE_URL = new URL(
  "../../../client-core/src/testing/fixtures/pozzetto2013.oracle.ts",
  import.meta.url,
);

// Pozzetto 2013's chart of accounts, derived from the seed as the Accounts
// screen derives it, written as keys and cents only: no name leaves the seed.
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

writeFileSync(FIXTURE_URL, renderOracleFixture(tree, DEVIATIONS));
console.log(`Wrote ${FIXTURE_URL.pathname}`);
