import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  POZZETTO_FIXTURE_URL,
  renderPozzetto2013Fixture,
} from "./pozzettoFixture.ts";

describe("the committed Pozzetto 2013 oracle fixture", () => {
  it("is what gen:oracle-fixture writes from the committed seed and DEVIATIONS, header included", () => {
    expect(readFileSync(POZZETTO_FIXTURE_URL, "utf8")).toBe(
      renderPozzetto2013Fixture(),
    );
  });
});
