import { describe, expect, it, vi } from "vitest";

import { mountConfirmAlert } from "./ConfirmAlert.page.tsx";

describe("ConfirmAlert", () => {
  it("is a notice in the alert width", () => {
    const page = mountConfirmAlert({});

    expect(page.title()).toBe("Notice");
    expect(page.width()).toBe("alert");
  });

  it("is an alert dialog that reads its question after its name", () => {
    const page = mountConfirmAlert({ text: 'Delete the entry "Rent"?' });

    expect(page.isAlertDescribedAs('Delete the entry "Rent"?')).toBe(true);
  });

  it("reads the reason Yes failed after its question", () => {
    const page = mountConfirmAlert({
      text: 'Delete the entry "Rent"?',
      error: "This entry cannot be deleted.",
    });

    expect(
      page.isAlertDescribedAs(
        'Delete the entry "Rent"? This entry cannot be deleted.',
      ),
    ).toBe(true);
  });

  it("opens with the focus on No, the answer that changes nothing", () => {
    expect(mountConfirmAlert({}).focusedButton()).toBe("No");
  });

  it("shows its text", () => {
    const page = mountConfirmAlert({ text: 'Delete the entry "Rent"?' });

    expect(page.text()).toBe('Delete the entry "Rent"?');
  });

  it("calls back on Yes", async () => {
    const onYes = vi.fn();
    const onNo = vi.fn();
    const page = mountConfirmAlert({ onYes, onNo });

    await page.yes();

    expect(onYes).toHaveBeenCalledTimes(1);
    expect(onNo).not.toHaveBeenCalled();
  });

  it("calls back on No", async () => {
    const onYes = vi.fn();
    const onNo = vi.fn();
    const page = mountConfirmAlert({ onYes, onNo });

    await page.no();

    expect(onNo).toHaveBeenCalledTimes(1);
    expect(onYes).not.toHaveBeenCalled();
  });

  it("answers No on Escape", () => {
    const onNo = vi.fn();
    const page = mountConfirmAlert({ onNo });

    page.pressEscape();

    expect(onNo).toHaveBeenCalledTimes(1);
  });

  it("shows the error under the text when there is one", () => {
    const page = mountConfirmAlert({ error: "This entry cannot be deleted." });

    expect(page.errorText()).toBe("This entry cannot be deleted.");
  });

  it("shows no error when there is none", () => {
    expect(mountConfirmAlert({ error: null }).errorText()).toBeNull();
  });
});
