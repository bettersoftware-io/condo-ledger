import { type ColumnSpec, columnSpecsFrom } from "@cl/client-core";

import type { TreeGridColumn } from "../TreeGrid.tsx";

// The Journal grid's headers and widths. Constants, apart from the component
// that draws them: a component file exports components only, and the grid's
// widths are kept for the spec it is drawn with.

/** The README's columns: the date and the number lead, the tree column follows. */
export const JOURNAL_COLUMNS: TreeGridColumn[] = [
  { header: "Date" },
  { header: "P.N.", align: "center" },
  { header: "Entry description / Postings" },
  { header: "Debit", align: "right" },
  { header: "Credit", align: "right" },
  { header: "Balance", align: "right" },
];

/** The description is the flexible one. */
export const JOURNAL_COLUMN_SPECS: ColumnSpec[] = columnSpecsFrom(
  [120, 48, 420, 110, 110, 110],
  2,
  240,
  900,
);
