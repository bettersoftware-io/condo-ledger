import { describe, expect, it, vi } from "vitest";

import { mountTabbedPanel } from "./TabbedPanel.page.tsx";

describe("TabbedPanel", () => {
  it("marks the active tab and shows the body it is given", () => {
    const page = mountTabbedPanel({
      tabs: ["Accounts", "Journal"],
      active: "Journal",
      onActivate: vi.fn(),
      children: "journal body",
    });

    expect(page.activeTab()).toBe("Journal");
    expect(page.body()).toBe("journal body");
  });

  it("asks to activate the tab that is clicked", async () => {
    const onActivate = vi.fn();
    const page = mountTabbedPanel({
      tabs: ["Accounts", "Journal"],
      active: "Accounts",
      onActivate,
      children: "x",
    });

    await page.activate("Journal");

    expect(onActivate).toHaveBeenCalledWith("Journal");
  });
});
