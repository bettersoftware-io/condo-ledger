import { type ColumnSpec, columnSpecsFrom } from "@cl/client-core";

import type { TreeGridColumn } from "../TreeGrid.tsx";

// The Installment Schedule's columns, in the README's order: the fixed ones
// before the installments, one per installment, the fixed ones after. The
// installments' own headers are drawn by the grid.

export const LEADING_COLUMNS: TreeGridColumn[] = [
  { header: "Groups / Units / Owners" },
  { header: "Role", align: "center" },
  { header: "Restr. period" },
  { header: "Days", align: "center" },
  { header: "Prev. bal.", align: "right" },
  { header: "Total budget", align: "right" },
  { header: "Total due", align: "right" },
];

export const TRAILING_COLUMNS: TreeGridColumn[] = [
  { header: "Total inst.", align: "right" },
  { header: "Paid", align: "right" },
  { header: "Inst. bal.", align: "right" },
  { header: "Overdue", align: "right" },
];

const LEADING_WIDTHS = [300, 46, 170, 66, 96, 100, 96];

const INSTALLMENT_WIDTH = 84;

const TRAILING_WIDTHS = [100, 96, 96, 96];

/** The widths for a schedule of `installments` columns; the first column is the flexible one. */
export function scheduleColumnSpecs(installments: number): ColumnSpec[] {
  return columnSpecsFrom(
    [
      ...LEADING_WIDTHS,
      ...Array.from({ length: installments }, () => {
        return INSTALLMENT_WIDTH;
      }),
      ...TRAILING_WIDTHS,
    ],
    0,
    240,
    560,
  );
}
