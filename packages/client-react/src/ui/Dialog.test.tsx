import { describe, expect, it, vi } from "vitest";

import { mountDialog } from "./Dialog.page.tsx";

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
});
