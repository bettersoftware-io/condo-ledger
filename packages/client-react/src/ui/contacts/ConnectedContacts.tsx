import type { ReactElement } from "react";

import type { ContactsView } from "@cl/client-core";

import { TreeGrid, type TreeGridRowData } from "../TreeGrid.tsx";
import { TESTIDS } from "../testids.ts";
import { CONNECTIONS_COLUMNS } from "./columns.ts";
import { contactCells } from "./contactCells.tsx";

import "./contactCells.css";

/**
 * The Connected Contacts tab: the contacts the selected one is connected to,
 * by order, each with what it is to the selected one (`Relationship`) and
 * the connected contact's own name, code, type, status, address, tax code and
 * VAT number. A click selects a row, which the tools act on. Takes only props, so the compiler memoizes it.
 */
export function ConnectedContacts({
  connections,
  selectedId,
  template,
  onSelect,
  onResize,
}: ConnectedContactsProps): ReactElement {
  return (
    <div className="connected-contacts" data-testid={TESTIDS.connectedContacts}>
      <TreeGrid
        columns={CONNECTIONS_COLUMNS}
        template={template}
        rows={connections.map((entry) => {
          return rowDataOf(entry, selectedId);
        })}
        emptyMessage="No connected contacts."
        onToggle={onSelect}
        onSelect={onSelect}
        onResize={onResize}
      />
    </div>
  );
}

export interface ConnectedContactsProps {
  /** The selected contact's connections, by order. */
  connections: ContactsView["connections"];
  /** The selected connection's id; null with none. */
  selectedId: string | null;
  /** grid-template-columns, from the columns machine. */
  template: string;
  onSelect: (connectionId: string) => void;
  onResize: (index: number, px: number) => void;
}

function rowDataOf(
  entry: ContactsView["connections"][number],
  selectedId: string | null,
): TreeGridRowData {
  const { connection, connected } = entry;

  return {
    key: connection.id,
    depth: 0,
    hasChildren: false,
    expanded: false,
    selected: connection.id === selectedId,
    emphasis: false,
    zebra: false,
    icon: null,
    label: connected.name,
    leading: [
      <span key="order" className="contact-order">
        {connection.order}
      </span>,
      <span key="relationship" className="contact-relationship">
        {connection.relationship}
      </span>,
    ],
    cells: contactCells(connected),
  };
}
