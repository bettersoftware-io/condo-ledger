import { type ColumnSpec, columnSpecsFrom } from "@cl/client-core";

import type { TreeGridColumn } from "../TreeGrid.tsx";

// The three grids of Thousandth Tables & Allocation: their headers and their
// widths, as the prototype draws them (ta-design.md §2–§4). The first column
// of each is the flexible one.

export const TABLES_COLUMNS: TreeGridColumn[] = [
  { header: "Name" },
  { header: "Restriction on" },
  { header: "Counter" },
  { header: "Total", align: "right" },
];

/** `minmax(120px,1fr) 104px 60px 84px`. */
export const TABLES_COLUMN_SPECS: ColumnSpec[] = columnSpecsFrom(
  [120, 104, 60, 84],
  0,
  120,
  360,
);

export const COEFFICIENTS_COLUMNS: TreeGridColumn[] = [
  { header: "Unit" },
  { header: "Period" },
  { header: "Coefficient", align: "right" },
];

/** `minmax(160px,1fr) 176px 100px`. */
export const COEFFICIENTS_COLUMN_SPECS: ColumnSpec[] = columnSpecsFrom(
  [200, 176, 100],
  0,
  160,
  420,
);

/** The Allocation's columns before the accounts'. */
export const ALLOCATION_LEADING_COLUMNS: TreeGridColumn[] = [
  { header: "Groups / Units / Owners" },
  { header: "Role", align: "center" },
  { header: "Restr. period" },
  { header: "Days", align: "center" },
];

/** The Allocation's columns after the accounts'. */
export const ALLOCATION_TRAILING_COLUMNS: TreeGridColumn[] = [
  { header: "Total", align: "right" },
  { header: "Prev. bal.", align: "right" },
  { header: "Total due", align: "right" },
  { header: "Paid", align: "right" },
];

const ALLOCATION_LEADING_WIDTHS = [240, 54, 150, 66];

const ACCOUNT_WIDTH = 104;

const ALLOCATION_TRAILING_WIDTHS = [108, 104, 116, 104];

/** The widths for an allocation of `accounts` columns: the first track is `minmax(380px,1fr)`. */
export function allocationColumnSpecs(accounts: number): ColumnSpec[] {
  return columnSpecsFrom(
    [
      ...ALLOCATION_LEADING_WIDTHS,
      ...Array.from({ length: accounts }, () => {
        return ACCOUNT_WIDTH;
      }),
      ...ALLOCATION_TRAILING_WIDTHS,
    ],
    0,
    380,
    560,
  );
}
