import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearPage, startAppOnPage } from "./startApp.page.tsx";
import { startApp } from "./startApp.tsx";

describe("starting the app", () => {
  beforeEach(() => {
    // With no server URL the composition says it chose the simulators.
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    clearPage();
    vi.restoreAllMocks();
  });

  it("draws the UI into #root, on the simulators", async () => {
    const page = await startAppOnPage();

    expect(page.heading()).toBe("CondoLedger");

    await page.stop();
  });

  it("leaves nothing drawn once it is stopped", async () => {
    const page = await startAppOnPage();

    await page.stop();

    expect(page.isBlank()).toBe(true);
  });

  it("refuses to start on a page with no #root", () => {
    expect(() => {
      return startApp();
    }).toThrow("index.html has no #root element");
  });
});
