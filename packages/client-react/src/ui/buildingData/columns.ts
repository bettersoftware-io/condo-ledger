import { type ColumnSpec, columnSpecsFrom } from "@cl/client-core";

import type { TreeGridColumn } from "../TreeGrid.tsx";

// The Building Data screen's two grids: their headers and their widths, as
// the design draws them (bu-design.md, Screen 2). Code comes before the tree
// column, Building / Period, which is the flexible one; the suppliers' first
// column is theirs.

export const BUILDING_DATA_COLUMNS: TreeGridColumn[] = [
  { header: "Code" },
  { header: "Building / Period" },
  { header: "Type", align: "center" },
  { header: "Closed", align: "center" },
  { header: "Period" },
  { header: "Liquidity", align: "right" },
  { header: "Funds", align: "right" },
  { header: "Budget", align: "right" },
  { header: "Actual", align: "right" },
  { header: "Prev. bal.", align: "right" },
  { header: "Total due", align: "right" },
];

/**
 * `46px minmax(200px,1fr) 50px 56px 164px 84px 84px 92px 92px 96px 100px`:
 * the design's, but Period is 164px, not 144px, so a period's dates
 * ("01/01/2013 - 31/12/2013") show whole.
 */
export const BUILDING_DATA_COLUMN_SPECS: ColumnSpec[] = columnSpecsFrom(
  [46, 260, 50, 56, 164, 84, 84, 92, 92, 96, 100],
  1,
  200,
  520,
);

export const SUPPLIERS_COLUMNS: TreeGridColumn[] = [
  { header: "Name / Company" },
  { header: "Contact category" },
];

/** `minmax(180px,1fr) 180px`. */
export const SUPPLIERS_COLUMN_SPECS: ColumnSpec[] = columnSpecsFrom(
  [260, 180],
  0,
  180,
  480,
);
