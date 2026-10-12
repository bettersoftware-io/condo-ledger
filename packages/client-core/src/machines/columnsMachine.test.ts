import { describe, expect, it } from "vitest";

import {
  type ColumnSpec,
  columnSpecsFrom,
  createColumnsMachine,
  reduceColumns,
  templateOf,
} from "./columnsMachine.ts";

describe("columnSpecsFrom", () => {
  it("applies the prototype's rule", () => {
    const spec = columnSpecsFrom(ACCOUNTS_WIDTHS, 0, 360, 680);

    expect(spec[0]).toEqual({ def: 400, min: 360, max: 680, grow: true });
    expect(spec[1]).toEqual({ def: 100, min: 60, max: 220, grow: false });
    expect(spec[6]).toEqual({ def: 44, min: 34, max: 97, grow: false });
    expect(spec[10]).toEqual({ def: 210, min: 126, max: 462, grow: false });
  });
});

describe("templateOf", () => {
  it("gives the Accounts default", () => {
    const spec = columnSpecsFrom(ACCOUNTS_WIDTHS, 0, 360, 680);

    expect(
      templateOf(
        spec,
        spec.map(() => {
          return null;
        }),
      ),
    ).toBe(ACCOUNTS_TEMPLATE);
  });

  it("uses the pixels of a resized column, grow or not", () => {
    expect(templateOf(createSpec(), [500, null, 80])).toBe("500px 100px 80px");
  });
});

describe("reduceColumns", () => {
  it("clamps to the column's bounds", () => {
    expect(reduce(start, { type: "resize", index: 1, px: 10 }).widths).toEqual([
      null,
      60,
      null,
    ]);
    expect(reduce(start, { type: "resize", index: 1, px: 999 }).widths).toEqual(
      [null, 220, null],
    );
  });

  it("ignores an index outside the spec", () => {
    expect(reduce(start, { type: "resize", index: 3, px: 100 })).toBe(start);
    expect(reduce(start, { type: "resize", index: -1, px: 100 })).toBe(start);
  });

  const reduce = reduceColumns(createSpec());

  const start = {
    widths: [null, null, null],
    template: "minmax(300px,1fr) 100px 50px",
  };
});

describe("the columns machine", () => {
  it("starts unresized and recomputes the template on resize", () => {
    const machine = createColumnsMachine(createSpec());

    expect(machine.state$.getValue()).toEqual({
      widths: [null, null, null],
      template: "minmax(300px,1fr) 100px 50px",
    });

    machine.intents.resize(2, 70);

    expect(machine.state$.getValue()).toEqual({
      widths: [null, null, 70],
      template: "minmax(300px,1fr) 100px 70px",
    });

    machine.dispose();
  });
});

function createSpec(): ColumnSpec[] {
  return [
    { def: 400, min: 300, max: 600, grow: true },
    { def: 100, min: 60, max: 220, grow: false },
    { def: 50, min: 34, max: 110, grow: false },
  ];
}

const ACCOUNTS_WIDTHS = [
  400, 100, 100, 100, 90, 130, 44, 170, 110, 44, 210, 56, 64,
];

const ACCOUNTS_TEMPLATE =
  "minmax(360px,1fr) 100px 100px 100px 90px 130px 44px 170px 110px 44px 210px 56px 64px";
