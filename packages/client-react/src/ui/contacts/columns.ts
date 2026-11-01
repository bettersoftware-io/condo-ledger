import { type ColumnSpec, columnSpecsFrom } from "@cl/client-core";

import type { TreeGridColumn } from "../TreeGrid.tsx";

// The Contacts screen's two grids: their headers and their widths, as the
// design draws them (README, section 8). The name is the tree column of both,
// the flexible one; the connections' Order and Relationship come before it.

export const CONTACTS_COLUMNS: TreeGridColumn[] = [
  { header: "Name / Company" },
  { header: "Code" },
  { header: "Type", align: "center" },
  { header: "St.", align: "center" },
  { header: "Reference address" },
  { header: "Tax code" },
  { header: "VAT no." },
  { header: "Lng.", align: "center" },
  { header: "Category" },
];

/** `minmax(220px,1.4fr) 92px 50px 44px 240px 140px 112px 46px 170px`. */
export const CONTACTS_COLUMN_SPECS: ColumnSpec[] = columnSpecsFrom(
  [260, 92, 50, 44, 240, 140, 112, 46, 170],
  0,
  220,
  520,
);

export const CONNECTIONS_COLUMNS: TreeGridColumn[] = [
  { header: "Order", align: "center" },
  { header: "Relationship" },
  { header: "Name" },
  { header: "Code" },
  { header: "Type", align: "center" },
  { header: "St.", align: "center" },
  { header: "Reference address" },
  { header: "Tax code" },
  { header: "VAT no." },
];

/** The design's `50px 156px minmax(150px,1.3fr) 64px 40px 36px minmax(170px,1.5fr) 130px 104px`; the name is the flexible one. */
export const CONNECTIONS_COLUMN_SPECS: ColumnSpec[] = columnSpecsFrom(
  [50, 156, 220, 92, 44, 44, 220, 130, 104],
  2,
  150,
  480,
);
