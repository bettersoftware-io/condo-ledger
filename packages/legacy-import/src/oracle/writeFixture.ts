import { writeFileSync } from "node:fs";

import {
  POZZETTO_FIXTURE_URL,
  renderPozzetto2013Fixture,
} from "./pozzettoFixture.ts";
import {
  POZZETTO_JOURNAL_FIXTURE_URL,
  renderPozzetto2013JournalFixture,
} from "./pozzettoJournalFixture.ts";

writeFileSync(POZZETTO_FIXTURE_URL, renderPozzetto2013Fixture());
console.log(`Wrote ${POZZETTO_FIXTURE_URL.pathname}`);
writeFileSync(POZZETTO_JOURNAL_FIXTURE_URL, renderPozzetto2013JournalFixture());
console.log(`Wrote ${POZZETTO_JOURNAL_FIXTURE_URL.pathname}`);
