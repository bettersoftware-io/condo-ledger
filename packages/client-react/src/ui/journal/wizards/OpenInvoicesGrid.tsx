import { type ReactElement, useId } from "react";

import type { OpenInvoiceRow } from "@cl/client-core";

import { formatDate } from "#/ui/format.ts";
import { Money } from "#/ui/Money.tsx";
import { TESTIDS } from "#/ui/testids.ts";

import "./OpenInvoicesGrid.css";

/**
 * The invoices waiting to be paid, to choose one from: the design's grid
 * `Nr. | Reason | Date | Due | Supplier`, and what each still owes. Each row
 * is a radio's label, as the selectable list's rows are, so the arrow keys
 * move the choice. A due date already past is drawn in `--neg`.
 */
export function OpenInvoicesGrid({
  rows,
  selectedId,
  onSelect,
}: OpenInvoicesGridProps): ReactElement {
  const name = useId();

  return (
    <div
      className="open-invoices"
      role="radiogroup"
      aria-label="Invoices waiting to be paid"
      data-required="true"
    >
      <div className="open-invoices-head">
        <span>Nr.</span>
        <span>Reason</span>
        <span>Date</span>
        <span>Due</span>
        <span>Supplier</span>
        <span className="wizard-amount-cell">Remaining</span>
      </div>
      {rows.length === 0 ? (
        <div
          className="open-invoices-empty"
          data-testid={TESTIDS.openInvoicesEmpty}
        >
          No invoice is waiting to be paid.
        </div>
      ) : null}
      {rows.map((row) => {
        const selected = row.id === selectedId;

        function select(): void {
          onSelect(row.id);
        }

        return (
          <label
            key={row.id}
            className="open-invoices-row"
            data-testid={TESTIDS.openInvoiceRow}
            data-selected={selected}
          >
            <input
              type="radio"
              className="open-invoices-radio"
              name={name}
              value={row.id}
              aria-label={`Invoice ${row.number} — ${row.supplier}`}
              checked={selected}
              onChange={select}
            />
            <span className="open-invoices-cell">{row.number}</span>
            <span className="open-invoices-cell">{row.reason}</span>
            <span className="open-invoices-cell">{formatDate(row.date)}</span>
            <span className="open-invoices-cell" data-overdue={row.overdue}>
              {row.dueDate === null ? "" : formatDate(row.dueDate)}
            </span>
            <span className="open-invoices-cell">{row.supplier}</span>
            <span className="open-invoices-cell wizard-amount-cell">
              <Money cents={row.remaining} variant="plain" />
            </span>
          </label>
        );
      })}
    </div>
  );
}

export interface OpenInvoicesGridProps {
  rows: OpenInvoiceRow[];
  /** The chosen invoice; null while none is. */
  selectedId: string | null;
  onSelect: (id: string) => void;
}
