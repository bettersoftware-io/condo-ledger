import type { ReactElement } from "react";

import type { JournalGridRow } from "@cl/client-core";
import { ZERO_CENTS } from "@cl/domain";

import { formatDateTime } from "../format.ts";
import { Money } from "../Money.tsx";
import { TreeGrid, type TreeGridRowData } from "../TreeGrid.tsx";
import { JOURNAL_COLUMNS } from "./columns.ts";
import { EntryIcon } from "./EntryIcon.tsx";

import "./JournalGrid.css";

/**
 * The Journal: the grid machine's rows as tree-grid rows. An entry leads with
 * its date and number, its kind's icon and its description, bold; an open
 * entry's postings follow it, muted, each with the running balance. A click on
 * a posting selects its entry. Takes only props, so the compiler memoizes it.
 */
export function JournalGrid({
  rows,
  template,
  searching,
  onToggle,
  onSelect,
  onResize,
}: JournalGridProps): ReactElement {
  function selectEntryOf(key: string): void {
    onSelect(entryIdOf(key));
  }

  return (
    <TreeGrid
      columns={JOURNAL_COLUMNS}
      template={template}
      rows={rows.map(rowDataOf)}
      emptyMessage={
        searching ? "No entry matches." : "No entry in this period."
      }
      onToggle={onToggle}
      onSelect={selectEntryOf}
      onResize={onResize}
    />
  );
}

export interface JournalGridProps {
  rows: JournalGridRow[];
  /** grid-template-columns, from the columns machine. */
  template: string;
  /** A search is active: an empty grid says nothing matches, not that the period is empty. */
  searching: boolean;
  onToggle: (id: string) => void;
  /** Called with the entry's id, whichever of its rows was clicked. */
  onSelect: (id: string) => void;
  onResize: (index: number, px: number) => void;
}

/** A posting row's key is its entry's id, a slash and its index; an entry id holds no slash. */
const POSTING_SEPARATOR = "/";

function entryIdOf(key: string): string {
  const separator = key.indexOf(POSTING_SEPARATOR);

  return separator === -1 ? key : key.slice(0, separator);
}

/** A posting row is never drawn selected: the highlight sits on its entry. */
function rowDataOf(row: JournalGridRow): TreeGridRowData {
  if (row.kind === "entry") {
    const { entry } = row;

    return {
      key: entry.id,
      depth: 0,
      hasChildren: entry.postings.length > 0,
      expanded: row.expanded,
      selected: row.selected,
      emphasis: true,
      zebra: false,
      icon: <EntryIcon kind={entry.kind} />,
      label: entry.description,
      leading: [
        <span key="date" className="journal-date">
          {formatDateTime(entry.at)}
        </span>,
        <span key="number" className="journal-number">
          {entry.number}
        </span>,
      ],
      cells: [
        <Money key="debit" cents={entry.debit} variant="plain" emphasis />,
        <Money key="credit" cents={entry.credit} variant="plain" emphasis />,
        <Money key="balance" cents={ZERO_CENTS} />,
      ],
    };
  }

  const { posting } = row;

  return {
    key: `${row.entryId}${POSTING_SEPARATOR}${row.index}`,
    depth: 1,
    hasChildren: false,
    expanded: false,
    selected: false,
    emphasis: false,
    zebra: true,
    tone: "muted",
    icon: null,
    label: posting.path,
    leading: ["", ""],
    cells: [
      <Money key="debit" cents={posting.debit} variant="plain" />,
      <Money key="credit" cents={posting.credit} variant="plain" />,
      <Money key="balance" cents={posting.balance} emphasis={!row.last} />,
    ],
  };
}
