import { writeFileSync } from "node:fs";

import {
  POZZETTO_FIXTURE_URL,
  renderPozzetto2013Fixture,
} from "./pozzettoFixture.ts";

writeFileSync(POZZETTO_FIXTURE_URL, renderPozzetto2013Fixture());
console.log(`Wrote ${POZZETTO_FIXTURE_URL.pathname}`);
