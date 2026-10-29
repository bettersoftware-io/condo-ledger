import { describe, expect, it, vi } from "vitest";

import {
  mountDialog,
  mountOpenedDialog,
  mountStackedDialogs,
} from "./Dialog.page.tsx";

describe("Dialog", () => {
  it("draws its title, its body and its footer", () => {
    const page = mountDialog({
      title: "Generic entry",
      children: <p>The lines</p>,
      footer: <span>Required fields are marked with *</span>,
    });

    expect(page.title()).toBe("Generic entry");
    expect(page.shows("The lines")).toBe(true);
    expect(page.shows("Required fields are marked with *")).toBe(true);
  });

  it("is a modal dialog named by its title", () => {
    const page = mountDialog({ title: "Notice" });

    expect(page.isModal()).toBe(true);
    expect(page.isNamed("Notice")).toBe(true);
  });

  it("is the default width unless told otherwise", () => {
    expect(mountDialog({}).width()).toBe("default");
  });

  it("carries the width it is given", () => {
    expect(mountDialog({ width: "wizard" }).width()).toBe("wizard");
  });

  it("has the focus once mounted", () => {
    expect(mountDialog({}).isCardFocused()).toBe(true);
  });

  it("keeps the focus on the card when it holds nothing Tab stops on", () => {
    const page = mountDialog({});

    page.press("Tab");

    expect(page.lastKeyWasKept()).toBe(true);
    expect(page.isCardFocused()).toBe(true);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    const page = mountDialog({ onClose });

    page.press("Escape");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open on another key", () => {
    const onClose = vi.fn();
    const page = mountDialog({ onClose });

    page.press("Enter");

    expect(onClose).not.toHaveBeenCalled();
  });

  it("Enter in a text field does what onEnter says; Enter in a checkbox or on the card does not", () => {
    const onEnter = vi.fn();
    const page = mountDialog({
      onEnter,
      children: (
        <>
          <input aria-label="Amount" />
          <input type="checkbox" aria-label="Apply" />
        </>
      ),
    });

    page.pressIn("Apply", "Enter");
    page.press("Enter");

    expect(onEnter).not.toHaveBeenCalled();

    page.pressIn("Amount", "Enter");

    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it("Enter in a text field of a dialog with no onEnter does nothing", () => {
    const onClose = vi.fn();
    const page = mountDialog({
      onClose,
      children: <input aria-label="Amount" />,
    });

    page.pressIn("Amount", "Enter");

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on a click on the scrim", async () => {
    const onClose = vi.fn();
    const page = mountDialog({ onClose });

    await page.clickScrim();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open on a click inside the card", async () => {
    const onClose = vi.fn();
    const page = mountDialog({ onClose });

    await page.clickTitle();

    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps Tab inside the card, from the last stop round to the first", async () => {
    const page = mountOpenedDialog();
    await page.open();

    await page.tab();

    expect(page.focused()).toBe("Credit");

    await page.tab();
    await page.tab();
    await page.tab();

    expect(page.focused()).toBe("Save");

    await page.tab();

    expect(page.focused()).toBe("Done");

    await page.tab();

    expect(page.focused()).toBe("Credit");
  });

  it("keeps Shift+Tab inside the card, from the first stop round to the last", async () => {
    const page = mountOpenedDialog();
    await page.open();

    await page.tab(true);

    expect(page.focused()).toBe("Done");

    await page.tab();

    expect(page.focused()).toBe("Credit");

    await page.tab(true);

    expect(page.focused()).toBe("Done");
  });

  it("gives the focus back to what opened it when it is closed", async () => {
    const page = mountOpenedDialog();
    await page.open();
    await page.tab();

    await page.press("Escape");

    expect(page.isOpen()).toBe(false);
    expect(page.openerHasFocus()).toBe(true);
  });

  it("gives the focus back to what opened it when the scrim is clicked", async () => {
    const page = mountOpenedDialog();
    await page.open();

    await page.clickScrim();

    expect(page.isOpen()).toBe(false);
    expect(page.openerHasFocus()).toBe(true);
  });

  it("gives the focus back to what opened it when it closes on its own", async () => {
    const page = mountOpenedDialog();
    await page.open();

    await page.click("Save");

    expect(page.isOpen()).toBe(false);
    expect(page.openerHasFocus()).toBe(true);
  });

  it("leaves the focus where its owner put it as it closed, never passing it to its opener", async () => {
    const page = mountOpenedDialog();
    await page.open();
    const focusesOnOpening = page.openerFocuses();

    await page.click("Done");

    expect(page.isOpen()).toBe(false);
    expect(page.fieldAfterHasFocus()).toBe(true);
    expect(page.openerFocuses()).toBe(focusesOnOpening);
  });

  it("closes only the top one of two stacked dialogs on Escape", () => {
    const onCloseOuter = vi.fn();
    const onCloseInner = vi.fn();
    const page = mountStackedDialogs(onCloseOuter, onCloseInner);

    page.pressOn("Inner", "Escape");

    expect(onCloseInner).toHaveBeenCalledTimes(1);
    expect(onCloseOuter).not.toHaveBeenCalled();
  });
});
