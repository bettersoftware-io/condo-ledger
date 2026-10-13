import { type ReactElement, type ReactNode, useState } from "react";

import type { AccountsGridState } from "@cl/client-core";
import { type Cents, type Result, ROOT_KEY, ZERO_CENTS } from "@cl/domain";

import { formatCents, parseAmount } from "../format.ts";
import { InlineEditor } from "../InlineEditor.tsx";
import { Money } from "../Money.tsx";
import { TreeGrid, type TreeGridRowData } from "../TreeGrid.tsx";
import { TESTIDS } from "../testids.ts";
import { AccountIcon } from "./AccountIcon.tsx";
import { ACCOUNTS_COLUMNS } from "./columns.ts";

/**
 * The chart of accounts: the grid machine's rows as tree-grid rows, the four
 * amounts, and the eight attribute columns the legacy report has (empty until
 * the accounts carry them). An expense leaf's budget is edited in place; which
 * row is being edited, and what is wrong with the text, is this view's own
 * state. Takes only props, so the compiler memoizes it.
 */
export function AccountsGrid({
  rows,
  selectedKey,
  template,
  onToggle,
  onSelect,
  onResize,
  onSetBudget,
}: AccountsGridProps): ReactElement {
  const [budgetEdit, setBudgetEdit] = useState<BudgetEdit>(NOT_EDITING);

  function editingBudgetOf(key: string): () => void {
    return (): void => {
      setBudgetEdit({ editing: key, error: null });
    };
  }

  function committingBudgetOf(accountId: string): (text: string) => void {
    return (text: string): void => {
      const amount = parseAmount(text);

      if (amount === null) {
        setBudgetEdit({ editing: budgetEdit.editing, error: "not an amount" });

        return;
      }

      // A keypress waits for nothing: the new budget comes back on the tree's
      // stream, and the verdict is shown when it arrives.
      void onSetBudget(accountId, amount)
        .then(showVerdict)
        .catch(reportUnsaved);
    };
  }

  function showVerdict(result: Result): void {
    setBudgetEdit(
      result.ok
        ? NOT_EDITING
        : { editing: budgetEdit.editing, error: reasonText(result.reason) },
    );
  }

  function cancelBudget(): void {
    setBudgetEdit(NOT_EDITING);
  }

  function budgetCellOf(row: GridRow): ReactNode {
    const { node } = row;
    const accountId =
      node.nature === "expenses" && node.scope?.kind === "account"
        ? node.scope.accountId
        : null;

    if (accountId === null) {
      return (
        <Money key="budget" cents={node.budget} emphasis={row.hasChildren} />
      );
    }

    if (budgetEdit.editing === row.key) {
      return (
        <InlineEditor
          key="budget"
          value={formatCents(node.budget ?? ZERO_CENTS)}
          error={budgetEdit.error}
          onCommit={committingBudgetOf(accountId)}
          onCancel={cancelBudget}
        />
      );
    }

    return (
      <button
        key="budget"
        type="button"
        className="accounts-budget"
        data-testid={TESTIDS.budgetCell}
        onClick={editingBudgetOf(row.key)}
      >
        <Money cents={node.budget} />
      </button>
    );
  }

  return (
    <TreeGrid
      columns={ACCOUNTS_COLUMNS}
      template={template}
      rows={rows.map((row) => {
        return rowDataOf(row, selectedKey, budgetCellOf(row));
      })}
      emptyMessage="No account matches."
      onToggle={onToggle}
      onSelect={onSelect}
      onResize={onResize}
    />
  );
}

type GridRow = AccountsGridState["rows"][number];

export interface AccountsGridProps {
  rows: GridRow[];
  selectedKey: string;
  /** grid-template-columns, from the columns machine. */
  template: string;
  onToggle: (key: string) => void;
  onSelect: (key: string) => void;
  onResize: (index: number, px: number) => void;
  /** Saves an expense leaf's budget; the domain's verdict comes back. */
  onSetBudget: (accountId: string, budget: Cents) => Promise<Result>;
}

/** The row whose budget is being edited, and what is wrong with its text. */
interface BudgetEdit {
  editing: string | null;
  error: string | null;
}

const NOT_EDITING: BudgetEdit = { editing: null, error: null };

/** The domain's reasons as the person reads them; a reason not listed here is shown as it is. */
const BUDGET_REASONS: Readonly<Record<string, string>> = {
  negative: "a budget cannot be negative",
};

/** Restr. period, R/d, Allocation tables, Restriction on, Ecc., Default contra, R/s, Detr. */
const ATTRIBUTE_CELLS = 8;

function reasonText(reason: string): string {
  return BUDGET_REASONS[reason] ?? reason;
}

/* v8 ignore next 3 -- only a real accounts store can fail to answer; the simulator always does */
function reportUnsaved(error: unknown): void {
  console.error("the budget was not saved", error);
}

/** A group row's amounts are bold, as the prototype draws them. */
function rowDataOf(
  row: GridRow,
  selectedKey: string,
  budget: ReactNode,
): TreeGridRowData {
  const { node } = row;
  const aggregate = row.hasChildren;

  return {
    key: row.key,
    depth: row.depth,
    hasChildren: row.hasChildren,
    expanded: row.expanded,
    selected: row.key === selectedKey,
    emphasis: aggregate,
    zebra: row.key === ROOT_KEY,
    icon: (
      <AccountIcon
        icon={node.icon}
        nature={node.nature}
        open={row.expanded}
        root={row.key === ROOT_KEY}
      />
    ),
    label: node.label,
    cells: [
      <Money
        key="debit"
        cents={node.debit}
        variant="plain"
        emphasis={aggregate}
      />,
      <Money
        key="credit"
        cents={node.credit}
        variant="plain"
        emphasis={aggregate}
      />,
      <Money key="balance" cents={node.balance} emphasis={aggregate} />,
      budget,
      ...Array.from({ length: ATTRIBUTE_CELLS }, () => {
        return null;
      }),
    ],
  };
}
