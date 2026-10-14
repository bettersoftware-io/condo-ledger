import { describe, expect, it, vi } from "vitest";

import { mountMenuItem } from "./MenuItem.page.tsx";

describe("MenuItem", () => {
  it("is a menu item named by its label", () => {
    const page = mountMenuItem({ label: "Generic entry" });

    expect(page.isMenuItemNamed("Generic entry")).toBe(true);
  });

  it("draws its icon before its label, out of its name", () => {
    const page = mountMenuItem({ label: "New invoice", icon: "▤" });

    expect(page.text()).toBe("▤New invoice");
    expect(page.isMenuItemNamed("New invoice")).toBe(true);
  });

  it("calls back when clicked", async () => {
    const onClick = vi.fn();
    const page = mountMenuItem({ onClick });

    await page.click();

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
