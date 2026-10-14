import { describe, expect, it, vi } from "vitest";

import { createRow, mountTreeGrid } from "./TreeGrid.page.tsx";

describe("TreeGrid", () => {
  it("draws one row per item with its depth, caret and selection state", () => {
    const page = mountTreeGrid({
      rows: [
        createRow("Assets", { hasChildren: true, expanded: true }),
        createRow("Cash", { depth: 2, selected: true }),
        createRow("Debts", { hasChildren: true, expanded: false }),
      ],
    });

    expect(page.rowLabels()).toEqual(["Assets", "Cash", "Debts"]);
    expect(page.depthOf("Cash")).toBe(2);
    expect(page.indentCountOf("Cash")).toBe(2);
    expect(page.indentCountOf("Assets")).toBe(0);
    expect(page.isExpanded("Assets")).toBe(true);
    expect(page.isExpanded("Debts")).toBe(false);
    expect(page.isSelected("Cash")).toBe(true);
    expect(page.isSelected("Assets")).toBe(false);
  });

  it("a click on the caret toggles, a click on the row selects", () => {
    const onToggle = vi.fn();
    const onSelect = vi.fn();
    const page = mountTreeGrid({ onToggle, onSelect });

    page.clickCaret("Assets");

    expect(onToggle).toHaveBeenCalledExactlyOnceWith("Assets");
    expect(onSelect).not.toHaveBeenCalled();

    page.clickRow("Cash");

    expect(onSelect).toHaveBeenCalledExactlyOnceWith("Cash");
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("selects a row from the keyboard", () => {
    const onSelect = vi.fn();
    const page = mountTreeGrid({ onSelect });

    page.pressKeyOnRow("Cash", "Enter");
    page.pressKeyOnRow("Cash", " ");
    page.pressKeyOnRow("Cash", "a");

    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenCalledWith("Cash");
  });

  it("a key pressed on the caret does not also select the row", () => {
    const onSelect = vi.fn();
    const page = mountTreeGrid({ onSelect });

    page.pressKeyOnCaret("Assets", "Enter");

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("a row without children has no caret, only a spacer", () => {
    const page = mountTreeGrid({});

    expect(page.hasCaret("Assets")).toBe(true);
    expect(page.hasCaret("Cash")).toBe(false);
  });

  it("shows the empty message when there are no rows, and the footer when given", () => {
    const page = mountTreeGrid({ rows: [], footer: ["Total", "10", "20"] });

    expect(page.emptyMessage()).toBe("No accounts");
    expect(page.footerTexts()).toEqual(["Total", "10", "20"]);
  });

  it("shows neither the empty message nor a footer when there are rows and no footer", () => {
    const page = mountTreeGrid({});

    expect(page.emptyMessage()).toBeNull();
    expect(page.footerTexts()).toEqual([]);
  });

  it("dragging a header boundary reports the column and the new width", () => {
    const onResize = vi.fn();
    const page = mountTreeGrid({ onResize });

    page.dragBoundary(1, 30, 120);

    expect(onResize).toHaveBeenCalledWith(1, 150);
  });

  it("a pointer moving over a boundary that was not pressed reports nothing", () => {
    const onResize = vi.fn();
    const page = mountTreeGrid({ onResize });

    page.moveOverBoundary(0, 40);

    expect(onResize).not.toHaveBeenCalled();
  });

  it("offers Collapse on an expanded row and Expand on a collapsed one", () => {
    const page = mountTreeGrid({
      rows: [
        createRow("Open", { hasChildren: true, expanded: true }),
        createRow("Shut", { hasChildren: true, expanded: false }),
      ],
    });

    expect(page.caretLabel("Open")).toBe("Collapse");
    expect(page.caretLabel("Shut")).toBe("Expand");
  });

  it("draws the cells of a row beyond the declared columns left-aligned", () => {
    const page = mountTreeGrid({
      rows: [createRow("Wide", { cells: ["a", "b", "c"] })],
    });

    expect(page.cellTexts("Wide")).toEqual(["Wide", "a", "b", "c"]);
  });

  it("draws leading cells before the tree cell, so the tree is not the first column", () => {
    const page = mountTreeGrid({
      columns: [
        { header: "Date" },
        { header: "P.N.", align: "center" },
        { header: "Entry" },
        { header: "Debit", align: "right" },
      ],
      template: "120px 48px minmax(200px,1fr) 100px",
      rows: [
        createRow("Fattura", {
          leading: ["10/01/2013", "1"],
          cells: ["360.18"],
        }),
      ],
    });

    expect(page.cellTexts("Fattura")).toEqual([
      "10/01/2013",
      "1",
      "Fattura",
      "360.18",
    ]);
    expect(page.alignmentsOf("Fattura")).toEqual([
      "left",
      "center",
      "left",
      "right",
    ]);
  });

  it("a muted row says so for its stylesheet", () => {
    const page = mountTreeGrid({
      rows: [createRow("Path", { tone: "muted" }), createRow("Plain")],
    });

    expect(page.toneOf("Path")).toBe("muted");
    expect(page.toneOf("Plain")).toBeNull();
  });

  it("applies the template it is given", () => {
    const page = mountTreeGrid({});

    expect(page.template()).toBe("minmax(200px,1fr) 100px 100px");
  });

  it("applies a new template when it changes", () => {
    const page = mountTreeGrid({});

    page.rerender({ template: "1fr 80px 80px" });

    expect(page.template()).toBe("1fr 80px 80px");
  });
});
