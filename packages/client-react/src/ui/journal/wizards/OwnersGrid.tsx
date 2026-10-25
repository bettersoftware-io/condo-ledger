import { type ReactElement, useId } from "react";

import type { PersonRow } from "@cl/client-core";

import { Money } from "#/ui/Money.tsx";
import { TESTIDS } from "#/ui/testids.ts";

import "./OwnersGrid.css";

/**
 * The owners who still owe an installment, to choose one from: the design's
 * grid `Name | Units | Total inst. | Paid | Inst. balance`. Each row is a
 * radio's label, as the selectable list's rows are, so the arrow keys move
 * the choice. In a dialog that runs short the rows shrink and scroll, as the
 * selectable list's do.
 */
export function OwnersGrid({
  rows,
  selectedId,
  onSelect,
}: OwnersGridProps): ReactElement {
  const name = useId();

  return (
    <div
      className="owners"
      role="radiogroup"
      aria-label="Owners with an installment to pay"
      data-required="true"
    >
      <div className="owners-head">
        <span>Name</span>
        <span>Units</span>
        <span className="wizard-amount-cell">Total inst.</span>
        <span className="wizard-amount-cell">Paid</span>
        <span className="wizard-amount-cell">Inst. balance</span>
      </div>
      <div className="owners-rows">
        {rows.length === 0 ? (
          <div className="owners-empty" data-testid={TESTIDS.ownersEmpty}>
            No owner has an installment to pay.
          </div>
        ) : null}
        {rows.map((row) => {
          const selected = row.personId === selectedId;
          const units = row.units.join(", ");

          function select(): void {
            onSelect(row.personId);
          }

          return (
            <label
              key={row.personId}
              className="owners-row"
              data-testid={TESTIDS.ownerRow}
              data-selected={selected}
            >
              <input
                type="radio"
                className="owners-radio"
                name={name}
                value={row.personId}
                aria-label={`${row.name} — ${units}`}
                checked={selected}
                onChange={select}
              />
              <span className="owners-cell">{row.name}</span>
              <span className="owners-cell">{units}</span>
              <span className="owners-cell wizard-amount-cell">
                <Money cents={row.total} variant="plain" />
              </span>
              <span className="owners-cell wizard-amount-cell">
                <Money cents={row.paid} variant="plain" />
              </span>
              <span className="owners-cell wizard-amount-cell">
                <Money cents={row.remaining} variant="plain" />
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export interface OwnersGridProps {
  rows: PersonRow[];
  /** The chosen owner's person; null while none is. */
  selectedId: string | null;
  onSelect: (personId: string) => void;
}
