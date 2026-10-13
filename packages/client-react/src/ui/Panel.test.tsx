import { describe, expect, it, vi } from "vitest";

import { mountPanel } from "./Panel.page.tsx";

describe("Panel", () => {
  it("shows its title, meta and body", () => {
    const page = mountPanel({
      title: "Accounts",
      meta: "12 rows",
      children: "content",
    });

    expect(page.title()).toBe("Accounts");
    expect(page.meta()).toBe("12 rows");
    expect(page.body()).toBe("content");
  });

  it("has no maximize button, and no meta, unless given", () => {
    const page = mountPanel({ title: "Accounts", children: "x" });

    expect(page.hasMaximize()).toBe(false);
    expect(page.meta()).toBeNull();
  });

  it("offers Maximize", () => {
    const page = mountPanel({
      title: "A",
      onToggleMaximize: vi.fn(),
      children: "x",
    });

    expect(page.maximizeLabel()).toBe("Maximize");
  });

  it("offers Restore once maximized", () => {
    const page = mountPanel({
      title: "A",
      maximized: true,
      onToggleMaximize: vi.fn(),
      children: "x",
    });

    expect(page.maximizeLabel()).toBe("Restore");
  });

  it("asks to toggle when the button is clicked", async () => {
    const onToggle = vi.fn();
    const page = mountPanel({
      title: "A",
      onToggleMaximize: onToggle,
      children: "x",
    });

    await page.clickMaximize();

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
