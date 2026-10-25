import type { ReactElement } from "react";

import { type CellStatus, type Cents, ZERO_CENTS } from "@cl/domain";

import { useLocale } from "../amountLocale.ts";
import { formatCents } from "../format.ts";
import { InlineEditor } from "../InlineEditor.tsx";
import { Money } from "../Money.tsx";
import { TESTIDS } from "../testids.ts";

import "./InstallmentCell.css";

/**
 * What one row owes on one installment, coloured by how much of it is paid
 * (README "Money cell"). An editable cell is a button that opens the inline
 * editor; a refused one says why in its tooltip. Takes only props, so the
 * compiler memoizes it.
 */
export function InstallmentCell({
  amount,
  status,
  emphasis,
  editable,
  refusal,
  editing,
  error,
  onEdit,
  onCommit,
  onCancel,
}: InstallmentCellProps): ReactElement {
  const locale = useLocale();

  if (editing) {
    return (
      <span className="installment-cell" data-testid={TESTIDS.installmentCell}>
        <InlineEditor
          value={formatCents(amount ?? ZERO_CENTS, locale)}
          error={error}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      </span>
    );
  }

  const money = <Money cents={amount} emphasis={emphasis} />;

  if (editable) {
    return (
      <button
        type="button"
        className="installment-cell"
        data-testid={TESTIDS.installmentCell}
        data-status={status ?? undefined}
        onClick={onEdit}
      >
        {money}
      </button>
    );
  }

  return (
    <span
      className="installment-cell"
      data-testid={TESTIDS.installmentCell}
      data-status={status ?? undefined}
      title={refusal ?? undefined}
    >
      {money}
    </span>
  );
}

export interface InstallmentCellProps {
  /** Null when the row has no item on the installment: blank. */
  amount: Cents | null;
  /** Null when nothing is owed: no colour. */
  status: CellStatus | null;
  /** Bold, on an aggregate row. */
  emphasis: boolean;
  /** A click opens the editor. */
  editable: boolean;
  /** Why the cell cannot be edited, as the person reads it; null when it can, or has no item. */
  refusal: string | null;
  editing: boolean;
  /** What is wrong with the text committed, under the editor. */
  error: string | null;
  onEdit: () => void;
  onCommit: (text: string) => void;
  onCancel: () => void;
}
