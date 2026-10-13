import { describe, expect, it, vi } from "vitest";

import { mountInlineEditor } from "./InlineEditor.page.tsx";

describe("InlineEditor", () => {
  it("is focused on mount", () => {
    const page = mountInlineEditor({ value: "12,00" });

    expect(page.isFocused()).toBe(true);
  });

  it("commits the typed text on Enter", async () => {
    const onCommit = vi.fn();
    const page = mountInlineEditor({ value: "1", onCommit });

    await page.type("42,50");
    page.pressEnter();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("42,50");
  });

  it("commits the typed text on blur", async () => {
    const onCommit = vi.fn();
    const page = mountInlineEditor({ value: "1", onCommit });

    await page.type("7");
    page.blur();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("7");
  });

  it("Enter then blur commits once", async () => {
    const onCommit = vi.fn();
    const page = mountInlineEditor({ value: "1", onCommit });

    await page.type("42,50");
    page.pressEnter();
    page.blur();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("42,50");
  });

  it("commits again once the text is changed after a commit", async () => {
    const onCommit = vi.fn();
    const page = mountInlineEditor({ value: "1", onCommit });

    await page.type("abc");
    page.pressEnter();
    await page.type("42,50");
    page.pressEnter();

    expect(onCommit.mock.calls).toEqual([["abc"], ["42,50"]]);
  });

  it("cancels on Escape and the blur that follows does not commit", async () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const page = mountInlineEditor({ value: "1", onCommit, onCancel });

    await page.type("9");
    page.pressEscape();
    page.blur();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("shows the error under the input", () => {
    const page = mountInlineEditor({ error: "Not a number" });

    expect(page.errorText()).toBe("Not a number");
  });

  it("shows no error when there is none", () => {
    expect(mountInlineEditor({ error: null }).errorText()).toBeNull();
  });
});
