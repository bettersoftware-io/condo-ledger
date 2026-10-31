import { describe, expect, it } from "vitest";

import { createContact, mountContactPicker } from "./ContactPicker.page.tsx";

describe("ContactPicker", () => {
  it("shows in its box a contact linked from outside it", () => {
    const contacts = [createContact("md1", "Ada Rossi")];
    const page = mountContactPicker({ contacts, value: null });

    expect(page.boxText()).toBe("");

    page.rerender({ value: "md1" });

    expect(page.boxText()).toBe("Ada Rossi");
  });
});
