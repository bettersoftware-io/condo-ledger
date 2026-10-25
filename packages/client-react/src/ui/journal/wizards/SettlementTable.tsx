import type { ReactElement } from "react";

import type { SettlementRow } from "@cl/client-core";

import { formatDate } from "#/ui/format.ts";
import { Money } from "#/ui/Money.tsx";
import { TESTIDS } from "#/ui/testids.ts";

import "./SettlementTable.css";

/**
 * The installments a collection pays, read only: the design's
 * `Installment | Unit | Due | Owed | Paid now`, one row per item, in the
 * order the settlement pays them. A row the collection pays in part is
 * marked "partial": oldest first that is the last row at most, but an edited
 * collection's lines kept as written can pay several items in part.
 */
export function SettlementTable({ rows }: SettlementTableProps): ReactElement {
  return (
    <div className="settlement" data-testid={TESTIDS.settlementTable}>
      <div className="settlement-head">
        <span>Installment</span>
        <span>Unit</span>
        <span>Due</span>
        <span className="wizard-amount-cell">Owed</span>
        <span className="wizard-amount-cell">Paid now</span>
        <span />
      </div>
      {rows.map((row, index) => {
        return (
          <div
            // An entry may pay one item on two lines: the index tells them apart.
            key={`${String(index)}:${row.itemId}`}
            className="settlement-row"
            data-testid={TESTIDS.settlementRow}
          >
            <span className="settlement-cell">{row.installment}</span>
            <span className="settlement-cell">{row.unitCode}</span>
            <span className="settlement-cell">{formatDate(row.dueDate)}</span>
            <span className="settlement-cell wizard-amount-cell">
              <Money cents={row.owed} variant="plain" />
            </span>
            <span className="settlement-cell wizard-amount-cell">
              <Money cents={row.paidNow} variant="plain" />
            </span>
            <span className="settlement-mark">
              {row.partial ? (
                <span
                  className="settlement-partial"
                  data-testid={TESTIDS.settlementPartial}
                >
                  partial
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export interface SettlementTableProps {
  /** The items the amount pays, as the wizard settles it. */
  rows: SettlementRow[];
}
