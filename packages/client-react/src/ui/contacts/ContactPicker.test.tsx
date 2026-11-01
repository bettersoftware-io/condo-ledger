import { describe, expect, it } from "vitest";

import {
  createContactView,
  mountContactPicker,
} from "./ContactPicker.page.tsx";

describe("ContactPicker", () => {
  it("shows in its box a contact linked from outside it", () => {
    const contacts = [createContactView("md1", "Ada Rossi")];
    const page = mountContactPicker({ contacts, value: null });

    expect(page.boxText()).toBe("");

    page.rerender({ value: "md1" });

    expect(page.boxText()).toBe("Ada Rossi");
  });

  it("offers active contacts only", async () => {
    const contacts = [
      createContactView("md1", "Ada Rossi"),
      createContactView("md2", "Ada Bianchi", "archived"),
    ];
    const page = mountContactPicker({ contacts });

    await page.type("Ada");

    expect(page.offered()).toEqual(["Ada Rossi"]);
  });

  it("keeps showing the name of a contact held that is archived", () => {
    const contacts = [createContactView("md2", "Ada Bianchi", "archived")];
    const page = mountContactPicker({ contacts, value: "md2" });

    expect(page.boxText()).toBe("Ada Bianchi");
  });

  it("is named Linked contact", () => {
    expect(mountContactPicker({}).boxLabel()).toBe("Linked contact");
  });

  it("is named by the label given", () => {
    expect(mountContactPicker({ label: "Contact" }).boxLabel()).toBe("Contact");
  });
});
