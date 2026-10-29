import { describe, expect, it } from "vitest";

import { mountFormField } from "./FormField.page.tsx";

describe("FormField", () => {
  it("names the field it holds by its label", () => {
    const page = mountFormField({ label: "Description" });

    expect(page.labelText()).toBe("Description");
    expect(page.hasTextBoxNamed("Description")).toBe(true);
  });

  it("is neither required nor read-only unless told", () => {
    const page = mountFormField({});

    expect(page.isRequired()).toBe(false);
    expect(page.isReadOnly()).toBe(false);
  });

  it("marks a required label with a trailing star", () => {
    const page = mountFormField({ label: "Amount", required: true });

    expect(page.isRequired()).toBe(true);
    expect(page.labelText()).toBe("Amount *");
  });

  it("keeps the star out of the field's name", () => {
    const page = mountFormField({ label: "Amount", required: true });

    expect(page.hasTextBoxNamed("Amount")).toBe(true);
  });

  it("draws a read-only box", () => {
    const page = mountFormField({
      label: "Paid from",
      readOnly: true,
      children: <span>Cash on hand</span>,
    });

    expect(page.isReadOnly()).toBe(true);
  });

  it("is a label for the field it holds", () => {
    expect(mountFormField({}).isLabelElement()).toBe(true);
  });

  it("a read-only row is a group named by its label, holding the value, and no label", () => {
    const page = mountFormField({
      label: "Paid from",
      readOnly: true,
      children: <span>Cash on hand</span>,
    });

    expect(page.groupText("Paid from")).toBe("Paid fromCash on hand");
    expect(page.isLabelElement()).toBe(false);
  });
});
