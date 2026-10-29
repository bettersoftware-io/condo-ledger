import { describe, expect, it, vi } from "vitest";

import { ok, type Result, rejected } from "@cl/domain";

import {
  createCoefficientNode,
  createCoefficientRows,
  holdVerdicts,
  mountCoefficientsPanel,
} from "./CoefficientsPanel.page.tsx";

describe("CoefficientsPanel", () => {
  it("draws a group bold, the sum of its units, and a unit with its period", () => {
    const page = mountCoefficientsPanel({ rows: createTree() });

    expect(page.title()).toBe("Table Coefficients");
    expect(page.grid.rowTexts("A - Scala A")).toEqual([
      "A - Scala A",
      "",
      "1,020.0000",
    ]);
    expect(page.grid.isAggregate("A - Scala A")).toBe(true);
    expect(page.grid.rowTexts("A1")).toEqual([
      "A1",
      "01/05/2011 - 31/05/2011",
      "1,000.0000",
    ]);
    expect(page.grid.isAggregate("A1")).toBe(false);
  });

  it("edits a unit's coefficient, never a group's", async () => {
    const page = mountCoefficientsPanel({ rows: createTree() });

    expect(page.isEditable("A - Scala A")).toBe(false);
    expect(page.isEditable("A1")).toBe(true);

    await page.clickCoefficient("A1");

    expect(page.editorText()).toBe("1000.0000");
    expect(page.isEditorNamed("Coefficient of A1")).toBe(true);
  });

  it("hands the text typed to the write, for the unit, and closes on its acceptance", async () => {
    const onSetCoefficient = vi.fn((): Promise<Result> => {
      return Promise.resolve(ok());
    });

    const page = mountCoefficientsPanel({
      rows: createTree(),
      onSetCoefficient,
    });

    await page.clickCoefficient("A2");
    await page.typeCoefficient("12.5");
    await page.pressEnter();

    expect(onSetCoefficient).toHaveBeenCalledWith("u2", "12.5");
    expect(page.editorOpen()).toBe(false);
  });

  it("a blur commits too: the editor stays open with the refusal's words, and Escape closes it", async () => {
    const page = mountCoefficientsPanel({
      rows: createTree(),
      onSetCoefficient: (): Promise<Result> => {
        return Promise.resolve(rejected("not-a-coefficient"));
      },
    });

    await page.clickCoefficient("A1");
    await page.typeCoefficient("abc");
    await page.blur();

    expect(page.editorText()).toBe("abc");
    expect(page.editorError()).toBe(
      "Enter a coefficient of zero or more, with at most 4 decimals",
    );

    await page.typeCoefficient("abcd");
    await page.pressEscape();

    expect(page.editorOpen()).toBe(false);
  });

  it("left as it opened, the editor closes and writes nothing", async () => {
    const onSetCoefficient = vi.fn();
    const page = mountCoefficientsPanel({
      rows: createTree(),
      onSetCoefficient,
    });

    await page.clickCoefficient("A1");
    await page.pressEnter();

    expect(page.editorOpen()).toBe(false);
    expect(onSetCoefficient).not.toHaveBeenCalled();
  });

  it("a verdict that arrives after another editor opened leaves that one alone", async () => {
    const held = holdVerdicts();
    const page = mountCoefficientsPanel({
      rows: createTree(),
      onSetCoefficient: held.save,
    });

    await page.clickCoefficient("A1");
    await page.typeCoefficient("5");
    await page.pressEnter();
    await page.clickCoefficient("A2");
    await page.typeCoefficient("7");

    await held.release(rejected("not-a-coefficient"));

    expect(page.editorText()).toBe("7");
    expect(page.editorError()).toBeNull();
  });

  it("toggles a group, expands and collapses all, and posts the refresh notice", async () => {
    const onToggle = vi.fn();
    const onExpandAll = vi.fn();
    const onCollapseAll = vi.fn();
    const onStub = vi.fn();
    const page = mountCoefficientsPanel({
      rows: createTree(),
      onToggle,
      onExpandAll,
      onCollapseAll,
      onStub,
    });

    expect(page.toolLabels()).toEqual([
      "Expand all",
      "Collapse all",
      "Refresh",
    ]);

    await page.grid.clickCaret("A - Scala A");
    await page.clickTool("Expand all");
    await page.clickTool("Collapse all");
    await page.clickTool("Refresh");
    await page.clickLegend();

    expect(onToggle).toHaveBeenCalledWith("group:ug1");
    expect(onExpandAll).toHaveBeenCalledOnce();
    expect(onCollapseAll).toHaveBeenCalledOnce();
    expect(onStub.mock.calls).toEqual([["Refresh"], ["Legend"]]);
  });
});

/** Group A with two units: A1 restricted, A2 not. */
function createTree(): ReturnType<typeof createCoefficientRows> {
  return createCoefficientRows([
    createCoefficientNode("group:ug1", {
      label: "A - Scala A",
      value: 10200000,
      children: [
        createCoefficientNode("unit:u1", {
          label: "A1",
          period: "01/05/2011 - 31/05/2011",
          value: 10000000,
        }),
        createCoefficientNode("unit:u2", { label: "A2", value: 200000 }),
      ],
    }),
  ]);
}
