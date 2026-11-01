import { describe, expect, it, vi } from "vitest";

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

  it("draws no button when it does not create", () => {
    expect(mountContactPicker({ creating: false }).tools()).toEqual([]);
  });

  it("draws New company, New person, Edit contact and Clear when it creates, the last two waiting for a contact", () => {
    const page = mountContactPicker({ creating: true });

    expect(page.tools()).toEqual([
      "New company",
      "New person",
      "Edit contact",
      "Clear",
    ]);
    expect(page.isToolDisabled("New company")).toBe(false);
    expect(page.isToolDisabled("Edit contact")).toBe(true);
    expect(page.isToolDisabled("Clear")).toBe(true);
  });

  it("draws only Edit contact for a fixed contact", () => {
    const contacts = [createContactView("md1", "Ada Rossi")];
    const page = mountContactPicker({
      contacts,
      value: "md1",
      fixed: true,
      creating: true,
    });

    expect(page.tools()).toEqual(["Edit contact"]);
    expect(page.isToolDisabled("Edit contact")).toBe(false);
  });

  it("raises the kind of a new contact, and Edit", async () => {
    const onNew = vi.fn();
    const onEdit = vi.fn();
    const contacts = [createContactView("md1", "Ada Rossi")];
    const page = mountContactPicker({
      contacts,
      value: "md1",
      creating: true,
      onNew,
      onEdit,
    });

    await page.clickTool("New company");
    await page.clickTool("New person");
    await page.clickTool("Edit contact");

    expect(onNew.mock.calls).toEqual([["company"], ["person"]]);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("Clear unlinks the contact and empties the box", async () => {
    const onChange = vi.fn();
    const contacts = [createContactView("md1", "Ada Rossi")];
    const page = mountContactPicker({
      contacts,
      value: "md1",
      creating: true,
      onChange,
    });

    await page.clickTool("Clear");

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
