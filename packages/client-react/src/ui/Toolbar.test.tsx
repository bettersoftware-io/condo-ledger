import { type ReactElement, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { mountToolbar } from "./Toolbar.page.tsx";
import { ToolbarButton } from "./ToolbarButton.tsx";
import { ToolbarCheckbox } from "./ToolbarCheckbox.tsx";
import { ToolbarDivider } from "./ToolbarDivider.tsx";
import { ToolbarSearch } from "./ToolbarSearch.tsx";

describe("Toolbar", () => {
  it("shows a button's label and calls back when clicked", async () => {
    const onClick = vi.fn();
    const page = mountToolbar(
      <ToolbarButton label="Add" tone="ok" onClick={onClick} />,
    );

    expect(page.buttonText("Add")).toBe("Add");
    expect(page.buttonTone("Add")).toBe("ok");

    await page.click("Add");

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps an icon-only button's label for assistive technology only", () => {
    const page = mountToolbar(
      <ToolbarButton
        label="Delete"
        iconOnly
        icon={<svg />}
        onClick={vi.fn()}
      />,
    );

    expect(page.buttonText("Delete")).toBe("");
  });

  it("shows its text in place of the label, which stays its name", () => {
    const page = mountToolbar(
      <ToolbarButton label="Page size" text="25 ▾" onClick={vi.fn()} />,
    );

    expect(page.buttonText("Page size")).toBe("25 ▾");
  });

  it("a button that opens a menu says so, and whether it is open", () => {
    const page = mountToolbar(
      <>
        <ToolbarButton label="Add" menuOpen={false} onClick={vi.fn()} />
        <ToolbarButton label="Sizes" menuOpen onClick={vi.fn()} />
        <ToolbarButton label="Save" onClick={vi.fn()} />
      </>,
    );

    expect(page.menuState("Add")).toBe("menu closed");
    expect(page.menuState("Sizes")).toBe("menu open");
    expect(page.menuState("Save")).toBeNull();
  });

  it("does not call back from a disabled button", async () => {
    const onClick = vi.fn();
    const page = mountToolbar(
      <ToolbarButton label="Save" disabled onClick={onClick} />,
    );

    expect(page.isDisabled("Save")).toBe(true);

    await page.click("Save");

    expect(onClick).not.toHaveBeenCalled();
  });

  it("reports each character typed into the search", async () => {
    const onChange = vi.fn();
    const page = mountToolbar(
      <ToolbarSearch value="" placeholder="Search" onChange={onChange} />,
    );

    await page.type("ab");

    expect(onChange).toHaveBeenNthCalledWith(1, "a");
    expect(onChange).toHaveBeenNthCalledWith(2, "b");
  });

  it("shows the search value it is given", () => {
    const page = mountToolbar(
      <ToolbarSearch value="rossi" placeholder="Search" onChange={vi.fn()} />,
    );

    expect(page.searchValue()).toBe("rossi");
  });

  it("toggles a checkbox through its label", async () => {
    const page = mountToolbar(<Hideable />);

    expect(page.isChecked("Hide empty")).toBe(false);

    await page.toggle("Hide empty");

    expect(page.isChecked("Hide empty")).toBe(true);
  });

  it("draws a divider where it is placed, between the buttons", () => {
    const page = mountToolbar(
      <>
        <ToolbarButton label="Add" onClick={vi.fn()} />
        <ToolbarDivider />
        <ToolbarButton label="Delete" onClick={vi.fn()} />
      </>,
    );

    expect(page.items()).toEqual(["Add", "|", "Delete"]);
  });
});

function Hideable(): ReactElement {
  const [checked, setChecked] = useState(false);

  return (
    <ToolbarCheckbox
      label="Hide empty"
      checked={checked}
      onChange={setChecked}
    />
  );
}
