import { type ColumnSpec, columnSpecsFrom } from "@cl/client-core";

import type { TreeGridColumn } from "../TreeGrid.tsx";

// The Units screen's two grids: their headers, the formulas the money
// headers' tooltips give, and their widths, as the design draws them
// (bu-design.md, Screen 3). The first column of each is the flexible one.

export const UNITS_COLUMNS: TreeGridColumn[] = [
  { header: "Groups / Units / Owners" },
  { header: "Floor", align: "center" },
  { header: "Int.", align: "center" },
  { header: "Sub.", align: "center" },
  { header: "Type" },
  { header: "Restr. period" },
  { header: "Prev. bal.", align: "right" },
  { header: "Budget", align: "right" },
  { header: "Actual", align: "right" },
  {
    header: "Total due",
    align: "right",
    title: "Previous balance + actual share",
  },
  { header: "Paid", align: "right" },
  {
    header: "Overdue",
    align: "right",
    title: "Installments due before today, not yet paid",
  },
  {
    header: "Adjustment",
    align: "right",
    title:
      "Total due − installments issued: positive asks for more, negative is a refund",
  },
];

/** `minmax(280px,1.6fr) 50px 40px 40px 110px 152px 92px 90px 90px 96px 80px 86px 92px`. */
export const UNITS_COLUMN_SPECS: ColumnSpec[] = columnSpecsFrom(
  [320, 50, 40, 40, 110, 152, 92, 90, 90, 96, 80, 86, 92],
  0,
  280,
  560,
);

export const UNIT_OWNERS_COLUMNS: TreeGridColumn[] = [
  { header: "Periods / Roles / Owners" },
  { header: "Owner relationship scenario" },
  { header: "Out", align: "center" },
  { header: "Restr. period" },
  { header: "Days", align: "center" },
  { header: "% Share", align: "center" },
  { header: "Comb. coeff.", align: "right" },
];

/** `260px 220px 50px 152px 76px 88px 96px`. */
export const UNIT_OWNERS_COLUMN_SPECS: ColumnSpec[] = columnSpecsFrom(
  [260, 220, 50, 152, 76, 88, 96],
  0,
  200,
  480,
);
