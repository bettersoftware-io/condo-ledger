import { describe, expect, it, vi } from "vitest";

import { mountDateField } from "./DateField.page.tsx";

describe("DateField", () => {
  it("shows the parsed date beside a short text", () => {
    const page = mountDateField({ value: "23/4", parsed: "2013-04-23" });

    expect(page.text()).toBe("23/4");
    expect(page.parsedText()).toBe("23/04/2013");
    expect(page.description()).toBe("23/04/2013");
  });

  it("shows nothing beside a text that is already in full form", () => {
    const page = mountDateField({ value: "23/04/2013", parsed: "2013-04-23" });

    expect(page.parsedText()).toBeNull();
    expect(page.description()).toBeNull();
  });

  it("shows nothing beside a text that does not parse", () => {
    const page = mountDateField({ value: "23/", parsed: null });

    expect(page.parsedText()).toBeNull();
  });

  it("hands the text typed to onChange", async () => {
    const onChange = vi.fn();
    const page = mountDateField({ onChange });

    await page.type("5");

    expect(onChange).toHaveBeenCalledWith("5");
  });

  it("marks a required field", () => {
    const page = mountDateField({ required: true });

    expect(page.isRequired()).toBe(true);
  });

  it("is disabled when it says so", () => {
    expect(mountDateField({ disabled: true }).isDisabled()).toBe(true);
  });

  it("is enabled by default", () => {
    expect(mountDateField({}).isDisabled()).toBe(false);
  });
});
