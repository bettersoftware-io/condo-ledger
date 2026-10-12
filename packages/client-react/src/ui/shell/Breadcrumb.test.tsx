import { describe, expect, it } from "vitest";

import type { LegacySeed } from "@cl/domain";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";

import { mountBreadcrumb } from "./Breadcrumb.page.tsx";

describe("Breadcrumb", () => {
  it("names the building, period and screen for the Accounts screen", () => {
    const page = mountBreadcrumb(createSmallSeed());

    expect(page.trail()).toBe(
      "Buildings › Pozzetto › 2013 (Ordinary) › Accounts, Ledgers & Balance",
    );
    expect(page.current()).toBe("Accounts, Ledgers & Balance");
  });

  it("follows the menu item", async () => {
    const page = mountBreadcrumb(createSmallSeed());

    await page.selectMenu("journal");

    expect(page.trail()).toBe(
      "Buildings › Pozzetto › 2013 (Ordinary) › Journal & Daybook",
    );
  });

  it("is the module's name elsewhere", async () => {
    const page = mountBreadcrumb(createSmallSeed());

    await page.selectModule("calendar");

    expect(page.trail()).toBe("Calendar");
    expect(page.current()).toBe("Calendar");

    await page.selectModule("contacts");

    expect(page.trail()).toBe("Contacts");
  });

  it("names only the screen while no period is chosen", () => {
    const page = mountBreadcrumb(createSeedWithoutBuildings());

    expect(page.trail()).toBe("Buildings › Accounts, Ledgers & Balance");
  });
});

function createSeedWithoutBuildings(): LegacySeed {
  return { ...createSmallSeed(), buildings: [] };
}
