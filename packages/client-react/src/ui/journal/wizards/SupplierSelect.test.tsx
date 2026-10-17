import { describe, expect, it, vi } from "vitest";

import { mountSupplierSelect } from "./SupplierSelect.page.tsx";

describe("SupplierSelect", () => {
  it("is disabled and shows its note when locked", () => {
    const page = mountSupplierSelect({
      choices: CHOICES,
      value: "md1",
      locked: true,
      note: "This invoice has payments: its supplier cannot change.",
    });

    expect(page.isDisabled()).toBe(true);
    expect(page.noteText()).toBe(
      "This invoice has payments: its supplier cannot change.",
    );
  });

  it("is enabled and has no note when it is neither locked nor noted", () => {
    const page = mountSupplierSelect({ choices: CHOICES });

    expect(page.isDisabled()).toBe(false);
    expect(page.noteText()).toBeNull();
  });

  it("draws the chosen supplier through the overlay", () => {
    const page = mountSupplierSelect({ choices: CHOICES, value: "md2" });

    expect(page.drawnText()).toBe("Supplier B");
  });

  it("asks for a supplier while none is chosen", () => {
    const page = mountSupplierSelect({ choices: CHOICES });

    expect(page.drawnText()).toBe("Choose a supplier…");
  });

  it("hands the key of the supplier picked to onChange", async () => {
    const onChange = vi.fn();
    const page = mountSupplierSelect({ choices: CHOICES, onChange });

    await page.choose("Supplier B");

    expect(onChange).toHaveBeenCalledWith("md2");
  });
});

const CHOICES = [
  { key: "md1", label: "Supplier A", group: "Suppliers" },
  { key: "md2", label: "Supplier B", group: "Suppliers" },
];
