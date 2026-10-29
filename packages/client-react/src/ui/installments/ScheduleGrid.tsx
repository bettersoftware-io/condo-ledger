import { type ReactElement, type ReactNode, useState } from "react";

import { parseAmount, type ScheduleGridRow } from "@cl/client-core";
import {
  type Cents,
  type Installment,
  type Restriction,
  type Result,
  type ScheduleCell,
  ZERO_CENTS,
} from "@cl/domain";

import { useLocale } from "../amountLocale.ts";
import { formatCents, formatDate } from "../format.ts";
import { Money } from "../Money.tsx";
import {
  TreeGrid,
  type TreeGridColumn,
  type TreeGridRowData,
} from "../TreeGrid.tsx";
import { LEADING_COLUMNS, TRAILING_COLUMNS } from "./columns.ts";
import { InstallmentCell } from "./InstallmentCell.tsx";
import { scheduleReasonText } from "./reasons.ts";

import "./ScheduleGrid.css";

/**
 * The installment schedule: the grid machine's rows as tree-grid rows, the
 * resident's attributes and amounts, and one cell per installment. A
 * resident's cell is edited in place when its `editable` allows it; which cell
 * is being edited, what is wrong with its text, and which row is selected
 * are this view's own state. Takes only props, so the compiler memoizes it.
 */
export function ScheduleGrid({
  rows,
  installments,
  template,
  onToggle,
  onResize,
  onSetItemAmount,
}: ScheduleGridProps): ReactElement {
  const [selected, setSelected] = useState<string | null>(null);
  const [edit, setEdit] = useState<CellEdit>(NOT_EDITING);
  const locale = useLocale();
  const columns: TreeGridColumn[] = [
    ...LEADING_COLUMNS,
    ...installments.map(installmentColumnOf),
    ...TRAILING_COLUMNS,
  ];

  function editingOf(itemId: string): () => void {
    return (): void => {
      setEdit({ editing: itemId, error: null });
    };
  }

  /** The commit of the editor on item `itemId`, which opened showing `before`. */
  function committingOf(
    itemId: string,
    before: string,
  ): (text: string) => void {
    return (text: string): void => {
      // Leaving the text as it was is a cancel: nothing to write.
      if (text === before) {
        settleOf(itemId, NOT_EDITING);

        return;
      }

      const amount = parseAmount(text, locale);

      if (amount === null) {
        settleOf(itemId, {
          editing: itemId,
          error: scheduleReasonText("not-an-amount"),
        });

        return;
      }

      // A keypress waits for nothing: the new amount comes back on the
      // schedule's stream, and the verdict is shown when it arrives.
      void onSetItemAmount(itemId, amount)
        .then(showingVerdictOf(itemId))
        .catch(reportUnsaved);
    };
  }

  function showingVerdictOf(itemId: string): (result: Result) => void {
    return (result: Result): void => {
      settleOf(
        itemId,
        result.ok
          ? NOT_EDITING
          : { editing: itemId, error: scheduleReasonText(result.reason) },
      );
    };
  }

  /** Applies what a commit on item `itemId` decided, unless another cell's editor has opened since. */
  function settleOf(itemId: string, next: CellEdit): void {
    setEdit((current) => {
      return current.editing === itemId ? next : current;
    });
  }

  function cancelEdit(): void {
    setEdit(NOT_EDITING);
  }

  /** The editor's name: the installment's number, and the row it is on. */
  function cellLabelOf(cell: ScheduleCell, owner: string): string {
    const installment = installments.find((candidate) => {
      return candidate.id === cell.installmentId;
    });

    return `Installment ${installment?.number ?? ""} of ${owner}`;
  }

  function installmentCellOf(
    cell: ScheduleCell,
    emphasis: boolean,
    owner: string,
  ): ReactNode {
    const { itemId } = cell;
    const label = cellLabelOf(cell, owner);

    // A unit's, the root's, or a resident's without an item: nothing to edit.
    if (itemId === null) {
      return (
        <InstallmentCell
          key={cell.installmentId}
          label={label}
          amount={cell.amount}
          status={cell.status}
          emphasis={emphasis}
          editable={false}
          refusal={null}
          editing={false}
          error={null}
          onEdit={cancelEdit}
          onCommit={cancelEdit}
          onCancel={cancelEdit}
        />
      );
    }

    const verdict = cell.editable;
    const editing = edit.editing === itemId;

    return (
      <InstallmentCell
        key={cell.installmentId}
        label={label}
        amount={cell.amount}
        status={cell.status}
        emphasis={emphasis}
        editable={verdict.ok}
        refusal={verdict.ok ? null : scheduleReasonText(verdict.reason)}
        editing={editing}
        error={editing ? edit.error : null}
        onEdit={editingOf(itemId)}
        onCommit={committingOf(
          itemId,
          formatCents(cell.amount ?? ZERO_CENTS, locale),
        )}
        onCancel={cancelEdit}
      />
    );
  }

  return (
    <TreeGrid
      columns={columns}
      template={template}
      rows={rows.map((row) => {
        return rowDataOf(row, selected, installmentCellOf);
      })}
      emptyMessage="No period is selected."
      onToggle={onToggle}
      onSelect={setSelected}
      onResize={onResize}
    />
  );
}

export interface ScheduleGridProps {
  rows: ScheduleGridRow[];
  /** In number order: the order of every row's cells. */
  installments: Installment[];
  /** grid-template-columns, from the columns machine. */
  template: string;
  onToggle: (key: string) => void;
  onResize: (index: number, px: number) => void;
  /** Saves an item's amount; the domain's verdict comes back. */
  onSetItemAmount: (itemId: string, amount: Cents) => Promise<Result>;
}

/** The item whose amount is being edited, and what is wrong with its text. */
interface CellEdit {
  editing: string | null;
  error: string | null;
}

const NOT_EDITING: CellEdit = { editing: null, error: null };

/** Two lines: the number, with 🔒 when locked, then the due date. */
function installmentColumnOf(installment: Installment): TreeGridColumn {
  const date = formatDate(installment.dueDate);
  const number = `${installment.number}${installment.locked ? " 🔒" : ""}`;

  return {
    header: `${number} ${date}`,
    align: "right",
    content: (
      <>
        <span className="schedule-head-line">{number}</span>{" "}
        <span className="schedule-head-line">{date}</span>
      </>
    ),
  };
}

/** The root and the units are aggregates: bold, on the zebra background. Roundings shows its Total budget and Total due only. */
function rowDataOf(
  row: ScheduleGridRow,
  selected: string | null,
  installmentCellOf: (
    cell: ScheduleCell,
    emphasis: boolean,
    owner: string,
  ) => ReactNode,
): TreeGridRowData {
  const { node } = row;
  const aggregate = node.kind === "root" || node.kind === "unit";
  const amounts = node.kind !== "roundings";

  return {
    key: row.key,
    depth: row.depth,
    hasChildren: row.hasChildren,
    expanded: row.expanded,
    selected: row.key === selected,
    emphasis: aggregate,
    zebra: aggregate,
    icon: null,
    label: node.label,
    cells: [
      <span key="role" className="schedule-text">
        {node.role}
      </span>,
      <span key="restriction" className="schedule-text">
        {restrictionText(node.restriction)}
      </span>,
      <span key="days" className="schedule-text">
        {node.days}
      </span>,
      <Money
        key="previous"
        cents={amounts ? node.previousBalance : null}
        emphasis={aggregate}
      />,
      <Money key="budget" cents={node.budget} emphasis={aggregate} />,
      <Money key="due" cents={node.due} emphasis={aggregate} />,
      ...node.cells.map((cell) => {
        return installmentCellOf(cell, aggregate, node.label);
      }),
      <Money
        key="total"
        cents={amounts ? node.totalInstallments : null}
        emphasis={aggregate}
      />,
      <Money
        key="paid"
        cents={amounts ? node.paid : null}
        emphasis={aggregate}
      />,
      <Money
        key="balance"
        cents={amounts ? node.balance : null}
        emphasis={aggregate}
      />,
      <Money
        key="overdue"
        cents={amounts ? node.overdue : null}
        emphasis={aggregate}
      />,
    ],
  };
}

/** "{from} - end of FY", "start of FY - {to}" or "{from} - {to}"; blank for the whole period. */
function restrictionText(restriction: Restriction | null): string {
  const from = restriction?.from ?? null;
  const to = restriction?.to ?? null;

  if (from === null) {
    return to === null ? "" : `start of FY - ${formatDate(to)}`;
  }

  return `${formatDate(from)} - ${to === null ? "end of FY" : formatDate(to)}`;
}

/* v8 ignore next 3 -- the simulator rejects only an item it does not hold, and the grid edits only the items it shows: only a real store fails otherwise */
function reportUnsaved(error: unknown): void {
  console.error("the amount was not saved", error);
}
