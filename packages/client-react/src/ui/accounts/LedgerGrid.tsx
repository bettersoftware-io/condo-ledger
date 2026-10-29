import type { ReactElement, ReactNode } from "react";

import type { Ledger } from "@cl/domain";

import { formatDateTime } from "../format.ts";
import { Money } from "../Money.tsx";
import { TreeGrid, type TreeGridRowData } from "../TreeGrid.tsx";
import { LEDGER_COLUMNS } from "./columns.ts";

import "./LedgerTab.css";

/**
 * The ledger as a flat tree grid: one row per posting, the running balance,
 * and a sticky totals row. Takes only props, so the compiler memoizes it.
 */
export function LedgerGrid({
  ledger,
  template,
  onResize,
}: LedgerGridProps): ReactElement {
  return (
    <TreeGrid
      columns={LEDGER_COLUMNS}
      template={template}
      rows={(ledger?.lines ?? []).map(rowDataOf)}
      footer={ledger === null ? undefined : footerOf(ledger)}
      emptyMessage="No posting on this account."
      onToggle={selectNothing}
      onSelect={selectNothing}
      onResize={onResize}
    />
  );
}

export interface LedgerGridProps {
  /** Null while the account has no ledger to show. */
  ledger: Ledger | null;
  /** grid-template-columns, from the columns machine. */
  template: string;
  onResize: (index: number, px: number) => void;
}

type LedgerLine = Ledger["lines"][number];

/** A line has no children to toggle and is not selected by a click: both reach here and change nothing. */
function selectNothing(): void {}

function rowDataOf(line: LedgerLine, index: number): TreeGridRowData {
  return {
    key: `${line.entryId}/${index}`,
    depth: 0,
    hasChildren: false,
    expanded: false,
    selected: false,
    emphasis: false,
    zebra: false,
    icon: null,
    label: formatDateTime(line.at),
    cells: [
      String(line.number),
      <span key="description" className="ledger-description">
        {line.description}
      </span>,
      <span key="posting" className="ledger-posting">
        {line.postingPath}
      </span>,
      <Money key="debit" cents={line.debit} variant="plain" />,
      <Money key="credit" cents={line.credit} variant="plain" />,
      <Money key="balance" cents={line.balance} />,
    ],
  };
}

function footerOf(ledger: Ledger): ReactNode[] {
  return [
    "",
    "",
    "",
    <span key="label" className="ledger-total-label">
      Total:
    </span>,
    <Money key="debit" cents={ledger.totalDebit} variant="plain" emphasis />,
    <Money key="credit" cents={ledger.totalCredit} variant="plain" emphasis />,
    <Money key="balance" cents={ledger.balance} emphasis />,
  ];
}
