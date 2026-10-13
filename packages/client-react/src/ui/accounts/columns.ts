import { type ColumnSpec, columnSpecsFrom } from "@cl/client-core";

import type { TreeGridColumn } from "../TreeGrid.tsx";

// The Accounts screen's two grids: their headers and their widths. Constants,
// apart from the components that draw them: a component file exports
// components only, and the columns machine reads its spec once.

/** The chart of accounts, in the README's order. */
export const ACCOUNTS_COLUMNS: TreeGridColumn[] = [
  { header: "Accounts" },
  { header: "Debit", align: "right" },
  { header: "Credit", align: "right" },
  { header: "Balance", align: "right" },
  { header: "Budget", align: "right" },
  { header: "Restr. period" },
  { header: "R/d", align: "center" },
  { header: "Allocation tables" },
  { header: "Restriction on" },
  { header: "Ecc.", align: "center" },
  { header: "Default contra" },
  { header: "R/s", align: "center" },
  { header: "Detr.", align: "center" },
];

/** The first column is the flexible one. */
export const ACCOUNTS_COLUMN_SPECS: ColumnSpec[] = columnSpecsFrom(
  [400, 100, 100, 100, 90, 130, 44, 170, 110, 44, 210, 56, 64],
  0,
  360,
  680,
);

/** One posting per row, with the running balance. */
export const LEDGER_COLUMNS: TreeGridColumn[] = [
  { header: "Date" },
  { header: "P.N.", align: "center" },
  { header: "Entry description" },
  { header: "Posting" },
  { header: "Debit", align: "right" },
  { header: "Credit", align: "right" },
  { header: "Balance", align: "right" },
];

/** The entry description is the flexible one. */
export const LEDGER_COLUMN_SPECS: ColumnSpec[] = columnSpecsFrom(
  [140, 48, 240, 180, 100, 100, 100],
  2,
  200,
  640,
);
