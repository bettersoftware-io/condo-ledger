import { describe, expect, it, vi } from "vitest";

import { mountTabbedPanel } from "./TabbedPanel.page.tsx";

describe("TabbedPanel", () => {
  it("marks the active tab and shows the body it is given", () => {
    const page = mountTabbedPanel({
      label: "Account",
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
      label: "Account",
      tabs: ["Accounts", "Journal"],
      active: "Accounts",
      onActivate,
      children: "x",
    });

    await page.activate("Journal");

    expect(onActivate).toHaveBeenCalledWith("Journal");
  });

  it("is a tab list named by its label", () => {
    const page = mountTabbedPanel({
      label: "Account",
      tabs: ["Accounts", "Journal"],
      active: "Journal",
      onActivate: vi.fn(),
      children: "x",
    });

    expect(page.isTabListNamed("Account")).toBe(true);
  });

  it("names its panel by the active tab", () => {
    const page = mountTabbedPanel({
      label: "Account",
      tabs: ["Accounts", "Journal"],
      active: "Journal",
      onActivate: vi.fn(),
      children: "x",
    });

    expect(page.panelName()).toBe("Journal");
  });

  it("is one stop for the Tab key: the active tab", () => {
    const page = mountTabbedPanel({
      label: "Account",
      tabs: ["Accounts", "Journal", "Ledger"],
      active: "Journal",
      onActivate: vi.fn(),
      children: "x",
    });

    expect(page.tabStops()).toEqual(["Journal"]);
  });

  it.each([
    ["ArrowRight", "Ledger"],
    ["ArrowLeft", "Accounts"],
    ["Home", "Accounts"],
    ["End", "Ledger"],
  ])("%s moves the focus to %s and activates it", async (key, next) => {
    const onActivate = vi.fn();
    const page = mountTabbedPanel({
      label: "Account",
      tabs: ["Accounts", "Journal", "Ledger"],
      active: "Journal",
      onActivate,
      children: "x",
    });

    await page.pressOnActiveTab(key);

    expect(page.focusedTab()).toBe(next);
    expect(onActivate).toHaveBeenCalledExactlyOnceWith(next);
  });

  it.each([
    ["ArrowRight", "Ledger", "Accounts"],
    ["ArrowLeft", "Accounts", "Ledger"],
  ])("%s from %s wraps around to %s", async (key, active, next) => {
    const onActivate = vi.fn();
    const page = mountTabbedPanel({
      label: "Account",
      tabs: ["Accounts", "Journal", "Ledger"],
      active,
      onActivate,
      children: "x",
    });

    await page.pressOnActiveTab(key);

    expect(page.focusedTab()).toBe(next);
    expect(onActivate).toHaveBeenCalledExactlyOnceWith(next);
  });

  it("does nothing on another key", async () => {
    const onActivate = vi.fn();
    const page = mountTabbedPanel({
      label: "Account",
      tabs: ["Accounts", "Journal"],
      active: "Journal",
      onActivate,
      children: "x",
    });

    await page.pressOnActiveTab("ArrowDown");

    expect(page.focusedTab()).toBe("Journal");
    expect(onActivate).not.toHaveBeenCalled();
  });
});
