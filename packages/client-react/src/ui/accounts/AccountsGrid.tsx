import { type ReactElement, type ReactNode, useState } from "react";

import { type AccountsGridState, parseAmount } from "@cl/client-core";
import { type Cents, type Result, ROOT_KEY, ZERO_CENTS } from "@cl/domain";

import { useLocale } from "../amountLocale.ts";
import { formatCents } from "../format.ts";
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
 * state. Amounts are shown and read in the session's locale. Takes only
 * props and the locale, so the compiler memoizes it; `compilerTracked` in
 * `architecture.config.mts` holds that.
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
  const locale = useLocale();

  function editingBudgetOf(key: string): () => void {
    return (): void => {
      setBudgetEdit({ editing: key, error: null });
    };
  }

  /** The commit of the editor on row `key`, which opened showing `before`. */
  function committingBudgetOf(
    key: string,
    accountId: string,
    before: string,
  ): (text: string) => void {
    return (text: string): void => {
      // Leaving the text as it was is a cancel: nothing to write, and nothing
      // to reject for a value the grid itself shows.
      if (text === before) {
        settleBudgetOf(key, NOT_EDITING);

        return;
      }

      const amount = parseAmount(text, locale);

      if (amount === null) {
        settleBudgetOf(key, { editing: key, error: "not an amount" });

        return;
      }

      // A keypress waits for nothing: the new budget comes back on the tree's
      // stream, and the verdict is shown when it arrives.
      void onSetBudget(accountId, amount)
        .then(showingVerdictOf(key))
        .catch(reportUnsaved);
    };
  }

  function showingVerdictOf(key: string): (result: Result) => void {
    return (result: Result): void => {
      settleBudgetOf(
        key,
        result.ok ? NOT_EDITING : { editing: key, error: result.reason },
      );
    };
  }

  /** Applies what a commit on row `key` decided, unless another row's editor has opened since. */
  function settleBudgetOf(key: string, next: BudgetEdit): void {
    setBudgetEdit((current) => {
      return current.editing === key ? next : current;
    });
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
      return <Money key="budget" cents={node.budget} />;
    }

    if (budgetEdit.editing === row.key) {
      const before = formatCents(node.budget ?? ZERO_CENTS, locale);

      return (
        <InlineEditor
          key="budget"
          value={before}
          error={budgetEdit.error}
          onCommit={committingBudgetOf(row.key, accountId, before)}
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
      rows={rows.map((row, position) => {
        return rowDataOf(row, position, selectedKey, budgetCellOf(row));
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

/** Restr. period, R/d, Allocation tables, Restriction on, Ecc., Default contra, R/s, Detr. */
const ATTRIBUTE_CELLS = 8;

/* v8 ignore next 3 -- only a real accounts store can fail to answer; the simulator always does */
function reportUnsaved(error: unknown): void {
  console.error("the budget was not saved", error);
}

/**
 * A row as the legacy grid draws it: an aggregate's label bold and its
 * amounts at the regular weight; every other visible row, from the first, on
 * a stripe by its place, Total like any other.
 */
function rowDataOf(
  row: GridRow,
  position: number,
  selectedKey: string,
  budget: ReactNode,
): TreeGridRowData {
  const { node } = row;

  return {
    key: row.key,
    depth: row.depth,
    hasChildren: row.hasChildren,
    expanded: row.expanded,
    selected: row.key === selectedKey,
    emphasis: row.hasChildren,
    zebra: position % 2 === 0,
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
      <Money key="debit" cents={node.debit} variant="plain" />,
      <Money key="credit" cents={node.credit} variant="plain" />,
      <Money key="balance" cents={node.balance} />,
      budget,
      ...Array.from({ length: ATTRIBUTE_CELLS }, () => {
        return null;
      }),
    ],
  };
}
