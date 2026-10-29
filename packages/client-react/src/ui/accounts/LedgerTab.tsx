import type { ReactElement } from "react";

import { useViewModel } from "@cl/react-bindings";

import { LEDGER_COLUMN_SPECS } from "./columns.ts";
import { LedgerGrid } from "./LedgerGrid.tsx";

/**
 * The selected account's ledger: one flat row per posting under it, oldest
 * first, with the running balance and a sticky totals row. A line is not
 * selectable. Reads the ledger and the columns, and hands plain props to
 * `LedgerGrid`.
 */
export function LedgerTab(): ReactElement {
  const { useLedger, useColumns } = useViewModel();
  const ledger = useLedger();
  const columns = useColumns("ledger", LEDGER_COLUMN_SPECS);

  return (
    <LedgerGrid
      ledger={ledger}
      template={columns.state.template}
      onResize={columns.resize}
    />
  );
}
