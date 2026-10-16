import { describe, expect, it, vi } from "vitest";

import { mountSelectableList } from "./SelectableList.page.tsx";
import type { SelectableItem } from "./SelectableList.tsx";

describe("SelectableList", () => {
  it("is a radio group named by its label", () => {
    const page = mountSelectableList({ label: "Cost account" });

    expect(page.isGroupNamed("Cost account")).toBe(true);
  });

  it("draws one row per item, in order", () => {
    const page = mountSelectableList({ items: createItems() });

    expect(page.rows()).toEqual(["Cleaning", "Lift", "Water"]);
  });

  it("draws an item's icon before its label, out of its name", async () => {
    const onSelect = vi.fn();
    const page = mountSelectableList({
      items: [{ key: "e1", label: "Cleaning", icon: "▤" }],
      onSelect,
    });

    await page.choose("Cleaning");

    expect(page.rows()).toEqual(["▤Cleaning"]);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("e1");
  });

  it("checks the selected item and draws it selected", () => {
    const page = mountSelectableList({
      items: createItems(),
      selectedKey: "e2",
    });

    expect(page.checked()).toBe("e2");
    expect(page.drawnSelected()).toBe("Lift");
  });

  it("checks none when nothing is selected", () => {
    const page = mountSelectableList({ items: createItems() });

    expect(page.checked()).toBeNull();
    expect(page.drawnSelected()).toBeNull();
  });

  it("calls back with the key of the item clicked", async () => {
    const onSelect = vi.fn();
    const page = mountSelectableList({ items: createItems(), onSelect });

    await page.choose("Water");

    expect(onSelect).toHaveBeenCalledExactlyOnceWith("e3");
  });

  it("moves the choice with the arrow keys", async () => {
    const onSelect = vi.fn();
    const page = mountSelectableList({
      items: createItems(),
      selectedKey: "e1",
      onSelect,
    });

    page.focus("Cleaning");
    await page.press("ArrowDown");

    expect(onSelect).toHaveBeenCalledExactlyOnceWith("e2");
  });
});

function createItems(): SelectableItem[] {
  return [
    { key: "e1", label: "Cleaning" },
    { key: "e2", label: "Lift" },
    { key: "e3", label: "Water" },
  ];
}
