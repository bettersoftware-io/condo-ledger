import { type ReactElement, useEffect, useRef, useState } from "react";

import type {
  ContactsView,
  MaximizeIntents,
  MaximizeState,
} from "@cl/client-core";
import type { ContactConnection } from "@cl/domain";
import { type MachineView, useViewModel } from "@cl/react-bindings";

import { ConfirmAlert } from "../ConfirmAlert.tsx";
import { Splitter } from "../shell/Splitter.tsx";
import { TESTIDS } from "../testids.ts";
import { useDialogWrite } from "../useDialogWrite.ts";
import { ConnectionDialog } from "./ConnectionDialog.tsx";
import { ContactsPanel } from "./ContactsPanel.tsx";
import { ContactTabs } from "./ContactTabs.tsx";
import { CONNECTIONS_COLUMN_SPECS, CONTACTS_COLUMN_SPECS } from "./columns.ts";
import { contactReasonText } from "./contactReasons.ts";
import { CONTACT_TABS } from "./labels.ts";

import "./ContactsScreen.css";

/**
 * Contacts: the Contact List over the selected contact's Contact Details and
 * Connected Contacts tabs, split by a splitter. Reads the view model and
 * hands plain props down. The maximize machine is the shell's, so a
 * maximized list also folds the sidebar. The split reaches the stylesheet as
 * `--split-ratio`, written in an effect as the other screens do.
 */
export function ContactsScreen({
  maximize,
}: ContactsScreenProps): ReactElement {
  const { useContactsScreen, useColumns, useSplit, useBottomTab, useNotices } =
    useViewModel();

  const {
    view,
    select,
    setPage,
    setPageSize,
    selectConnection,
    deleteConnection,
  } = useContactsScreen();
  const columns = useColumns("contacts", CONTACTS_COLUMN_SPECS);
  const connectionsColumns = useColumns(
    "connections",
    CONNECTIONS_COLUMN_SPECS,
  );
  const split = useSplit("contacts");
  const tabs = useBottomTab("contacts", CONTACT_TABS);
  const { stub } = useNotices();
  const [connectionDialog, setConnectionDialog] =
    useState<ConnectionDialogOpen | null>(null);

  const removing = useDialogWrite(
    closeConnectionDialog,
    "the connection was not deleted",
  );
  const screen = useRef<HTMLDivElement>(null);
  const ratio = split.state.ratio;
  const maximized = maximize.state.maximized;

  useEffect(() => {
    screen.current?.style.setProperty("--split-ratio", String(ratio));
  }, [ratio]);

  function moveSplitBy(deltaPx: number): void {
    const height = screen.current?.getBoundingClientRect().height ?? 0;

    if (height > 0) {
      split.setRatio(ratio + deltaPx / height);
    }
  }

  function toggleTopMaximized(): void {
    maximize.toggle("top");
  }

  function closeConnectionDialog(): void {
    setConnectionDialog(null);
  }

  function openAddConnection(): void {
    setConnectionDialog({ kind: "edit", connection: null });
  }

  function openEditConnection(): void {
    setConnectionDialog({
      kind: "edit",
      connection: view?.selectedConnection?.connection ?? null,
    });
  }

  function openDeleteConnection(): void {
    removing.forget();
    setConnectionDialog({
      kind: "delete",
      connection: view?.selectedConnection?.connection ?? null,
    });
  }

  function confirmDeleteConnection(): void {
    const id = connectionDialog?.connection?.id;

    if (id !== undefined) {
      removing.run(() => {
        return deleteConnection(id);
      });
    }
  }

  return (
    <div
      ref={screen}
      className="contacts-screen"
      data-testid={TESTIDS.contactsScreen}
      data-maximized={maximized ?? "none"}
    >
      <div className="contacts-top">
        <ContactsPanel
          contacts={view?.rows ?? []}
          selectedId={view?.selected?.id ?? null}
          page={view?.page ?? 1}
          pageCount={view?.pageCount ?? 1}
          pageSize={view?.pageSize ?? 10}
          total={view?.total ?? 0}
          template={columns.state.template}
          maximized={maximized === "top"}
          onSelect={select}
          onPage={setPage}
          onPageSize={setPageSize}
          onResize={columns.resize}
          onToggleMaximize={toggleTopMaximized}
          onStub={stub}
        />
      </div>
      <Splitter direction="horizontal" onDrag={moveSplitBy} />
      <div className="contacts-bottom">
        <ContactTabs
          active={tabs.state.active}
          contact={view?.selected ?? null}
          uses={view?.uses ?? null}
          connections={view?.connections ?? []}
          selectedConnectionId={view?.selectedConnection?.connection.id ?? null}
          connectionsTemplate={connectionsColumns.state.template}
          onActivate={tabs.activate}
          onSelectConnection={selectConnection}
          onAddConnection={openAddConnection}
          onEditConnection={openEditConnection}
          onDeleteConnection={openDeleteConnection}
          onResizeConnections={connectionsColumns.resize}
          onStub={stub}
        />
      </div>
      {connectionDialog?.kind === "edit" && view?.selected ? (
        <ConnectionDialog
          contactId={view.selected.id}
          editing={connectionDialog.connection}
          onSaved={closeConnectionDialog}
          onCancel={closeConnectionDialog}
        />
      ) : null}
      {connectionDialog?.kind === "delete" ? (
        <ConfirmAlert
          text={`Remove ${connectedNameOf(connectionDialog.connection, view)} from this contact?`}
          error={
            removing.refusal === null
              ? null
              : contactReasonText(removing.refusal, "")
          }
          onYes={confirmDeleteConnection}
          onNo={closeConnectionDialog}
        />
      ) : null}
    </div>
  );
}

export interface ContactsScreenProps {
  /** The shell's: which panel fills the screen, shared with the sidebar's rail. */
  maximize: MachineView<MaximizeState, MaximizeIntents>;
}

/** The connection dialog over the screen: the Add or Edit one, or the question before a delete. */
interface ConnectionDialogOpen {
  kind: "edit" | "delete";
  /** The connection it acts on; null for a new one. */
  connection: ContactConnection | null;
}

/** The name of the contact a connection names, as the screen lists it. */
function connectedNameOf(
  connection: ContactConnection | null,
  view: ContactsView | null,
): string {
  return (
    view?.connections.find((entry) => {
      return entry.connection.id === connection?.id;
    })?.connected.name ?? ""
  );
}
