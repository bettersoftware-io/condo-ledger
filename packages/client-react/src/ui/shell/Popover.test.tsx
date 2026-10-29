import { describe, expect, it } from "vitest";

import { mountPopover } from "./Popover.page.tsx";

describe("Popover", () => {
  it("puts the focus on its first item when it opens", async () => {
    const page = mountPopover(ITEMS);

    await page.open();

    expect(page.isOpen()).toBe(true);
    expect(page.focusedItem()).toBe("Generic entry");
  });

  it("opens from the keyboard on its first item", async () => {
    const page = mountPopover(ITEMS);

    await page.openFromKeyboard();

    expect(page.focusedItem()).toBe("Generic entry");
  });

  it("moves down and up its items with the arrow keys, wrapping at the ends", async () => {
    const page = mountPopover(ITEMS);
    await page.open();

    await page.press("ArrowDown");

    expect(page.focusedItem()).toBe("Direct payment");

    await page.press("ArrowDown");
    await page.press("ArrowDown");

    expect(page.focusedItem()).toBe("Generic entry");

    await page.press("ArrowUp");

    expect(page.focusedItem()).toBe("New invoice");
  });

  it("goes to its last item on End and its first on Home", async () => {
    const page = mountPopover(ITEMS);
    await page.open();

    await page.press("End");

    expect(page.focusedItem()).toBe("New invoice");

    await page.press("Home");

    expect(page.focusedItem()).toBe("Generic entry");
  });

  it("closes on Escape and gives the focus back to its button", async () => {
    const page = mountPopover(ITEMS);
    await page.open();
    await page.press("ArrowDown");

    await page.press("Escape");

    expect(page.isOpen()).toBe(false);
    expect(page.buttonHasFocus()).toBe(true);
  });

  it("gives the focus back to its button when an item is picked", async () => {
    const page = mountPopover(ITEMS);
    await page.open();

    await page.pick("Direct payment");

    expect(page.picked()).toEqual(["Direct payment"]);
    expect(page.isOpen()).toBe(false);
    expect(page.buttonHasFocus()).toBe(true);
  });

  it("gives the focus back to its button on a click outside", async () => {
    const page = mountPopover(ITEMS);
    await page.open();

    await page.clickOutside();

    expect(page.isOpen()).toBe(false);
    expect(page.buttonHasFocus()).toBe(true);
  });

  it("closes when the Tab key leaves it", async () => {
    const page = mountPopover(ITEMS);
    await page.open();

    await page.press("Tab");

    expect(page.isOpen()).toBe(false);
  });

  it("leaves the focus where it is on another key", async () => {
    const page = mountPopover(ITEMS);
    await page.open();

    await page.press("ArrowRight");

    expect(page.isOpen()).toBe(true);
    expect(page.focusedItem()).toBe("Generic entry");
  });
});

const ITEMS = ["Generic entry", "Direct payment", "New invoice"] as const;
