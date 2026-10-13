import type { ReactElement } from "react";

import type { AccountsGridState } from "@cl/client-core";
import { ROOT_KEY } from "@cl/domain";

import { Money } from "../Money.tsx";
import { TreeGrid, type TreeGridRowData } from "../TreeGrid.tsx";
import { AccountIcon } from "./AccountIcon.tsx";
import { ACCOUNTS_COLUMNS } from "./columns.ts";

/**
 * The chart of accounts: the grid machine's rows as tree-grid rows, the four
 * amounts, and the eight attribute columns the legacy report has (empty until
 * the accounts carry them). Takes only props, so the compiler memoizes it.
 */
export function AccountsGrid({
  rows,
  selectedKey,
  template,
  onToggle,
  onSelect,
  onResize,
}: AccountsGridProps): ReactElement {
  return (
    <TreeGrid
      columns={ACCOUNTS_COLUMNS}
      template={template}
      rows={rows.map((row) => {
        return rowDataOf(row, selectedKey);
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
}

/** Restr. period, R/d, Allocation tables, Restriction on, Ecc., Default contra, R/s, Detr. */
const ATTRIBUTE_CELLS = 8;

/** A group row's amounts are bold, as the prototype draws them. */
function rowDataOf(row: GridRow, selectedKey: string): TreeGridRowData {
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
      <Money key="budget" cents={node.budget} emphasis={aggregate} />,
      ...Array.from({ length: ATTRIBUTE_CELLS }, () => {
        return null;
      }),
    ],
  };
}
