import { describe, expect, it, vi } from "vitest";

import { cents } from "@cl/domain";

import { mountInstallmentCell } from "./InstallmentCell.page.tsx";

describe("InstallmentCell", () => {
  it("shows the amount en-US, coloured by its settlement", () => {
    const page = mountInstallmentCell({
      amount: cents(123456),
      status: "partial",
    });

    expect(page.text()).toBe("1,234.56");
    expect(page.status()).toBe("partial");
  });

  it("has no colour when nothing is owed, and is blank with no item", () => {
    expect(
      mountInstallmentCell({ amount: cents(0), status: null }).status(),
    ).toBeNull();
    expect(
      mountInstallmentCell({
        amount: null,
        status: null,
        editable: false,
      }).text(),
    ).toBe("");
  });

  it("an aggregate's amount is bold", () => {
    expect(
      mountInstallmentCell({ emphasis: true, editable: false }).isBold(),
    ).toBe(true);
    expect(mountInstallmentCell({}).isBold()).toBe(false);
  });

  it("an editable cell opens its editor on a click", async () => {
    const onEdit = vi.fn();
    const page = mountInstallmentCell({ onEdit });

    expect(page.isEditable()).toBe(true);
    expect(page.title()).toBeNull();

    await page.click();

    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("a refused cell offers no editor, and its tooltip says why", () => {
    const page = mountInstallmentCell({
      editable: false,
      refusal: "Paid already.",
      status: "settled",
    });

    expect(page.isEditable()).toBe(false);
    expect(page.title()).toBe("Paid already.");
    expect(page.status()).toBe("settled");
  });

  it("while editing, shows the amount as text to change, commits on Enter and cancels on Escape", async () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const page = mountInstallmentCell({
      amount: cents(123456),
      editing: true,
      onCommit,
      onCancel,
    });

    expect(page.isEditing()).toBe(true);
    expect(page.editorText()).toBe("1,234.56");

    await page.type("10.00");
    await page.pressEnter();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("10.00");

    await page.type("11.00");
    await page.pressEscape();

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("while editing a blank cell, starts from zero; the error shows under the editor", () => {
    const page = mountInstallmentCell({
      amount: null,
      editing: true,
      error: "Enter an amount",
    });

    expect(page.editorText()).toBe("0.00");
    expect(page.errorText()).toBe("Enter an amount");
  });
});
