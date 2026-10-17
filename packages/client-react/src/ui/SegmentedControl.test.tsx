import { describe, expect, it, vi } from "vitest";

import { mountSegmentedControl } from "./SegmentedControl.page.tsx";
import type { SegmentOption } from "./SegmentedControl.tsx";

describe("SegmentedControl", () => {
  it("is a radio group with the given name, one pill for each option", () => {
    const page = mountSegmentedControl(createProps());

    expect(page.isGroupNamed("Supplier kind")).toBe(true);
    expect(page.labels()).toEqual(["Company", "Professional"]);
  });

  it("draws the chosen pill as selected", () => {
    const page = mountSegmentedControl(createProps({ value: "pro" }));

    expect(page.drawnSelected()).toBe("Professional");
  });

  it("calls onChange with the value of the pill clicked", async () => {
    const onChange = vi.fn();
    const page = mountSegmentedControl(createProps({ onChange }));

    await page.choose("Professional");

    expect(onChange).toHaveBeenCalledWith("pro");
  });

  it("moves on ArrowRight and calls onChange", async () => {
    const onChange = vi.fn();
    const page = mountSegmentedControl(createProps({ onChange }));

    await page.pressOn("Company", "{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("pro");
  });

  it("moves back on ArrowLeft", async () => {
    const onChange = vi.fn();
    const page = mountSegmentedControl(createProps({ value: "pro", onChange }));

    await page.pressOn("Professional", "{ArrowLeft}");

    expect(onChange).toHaveBeenCalledWith("company");
  });
});

function createProps(
  overrides: Partial<Parameters<typeof mountSegmentedControl>[0]> = {},
): Parameters<typeof mountSegmentedControl>[0] {
  return {
    label: "Supplier kind",
    options: OPTIONS,
    value: "company",
    onChange: vi.fn(),
    ...overrides,
  };
}

const OPTIONS: SegmentOption<string>[] = [
  { value: "company", label: "Company" },
  { value: "pro", label: "Professional" },
];
