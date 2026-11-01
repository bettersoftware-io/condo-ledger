import { type ReactElement, useEffect, useRef, useState } from "react";

import type {
  ContactDialogSpec,
  ContactsView,
  MaximizeIntents,
  MaximizeState,
} from "@cl/client-core";
import {
  type Contact,
  type ContactConnection,
  nameOf,
  type Rejected,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";
import { type MachineView, useViewModel } from "@cl/react-bindings";

import { ConfirmAlert } from "../ConfirmAlert.tsx";
import { Splitter } from "../shell/Splitter.tsx";
import { TESTIDS } from "../testids.ts";
import { useDialogWrite } from "../useDialogWrite.ts";
import { ConnectionDialog } from "./ConnectionDialog.tsx";
import { ContactDialog } from "./ContactDialog.tsx";
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
    reveal,
    selectConnection,
    deleteConnection,
    deleteContact,
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

  const [contactDialog, setContactDialog] = useState<ContactDialogOpen | null>(
    null,
  );

  const deleting = useDialogWrite(
    closeContactDialog,
    "the contact was not deleted",
  );

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

  function closeContactDialog(): void {
    setContactDialog(null);
  }

  function openNewContact(kind: "person" | "company"): void {
    setContactDialog({ kind: "edit", spec: { kind, editing: null } });
  }

  // The tools are off with no contact selected: there is one when they are pressed.
  function selectedContact(): Contact {
    return must(view?.selected?.contact, "the selected contact");
  }

  function openEditContact(): void {
    const contact = selectedContact();

    setContactDialog({
      kind: "edit",
      spec: { kind: contact.kind, editing: contact },
    });
  }

  function openDeleteContact(): void {
    deleting.forget();
    setContactDialog({ kind: "delete", contact: selectedContact() });
  }

  function confirmDeleteContact(contact: Contact): void {
    deleting.run(() => {
      return deleteContact(contact.id);
    });
  }

  // A rename can move the row to another page: the contact saved is selected wherever it lands.
  function revealSavedOf(spec: ContactDialogSpec): () => void {
    return (): void => {
      if (spec.editing !== null) {
        reveal(spec.editing.id);
      }

      closeContactDialog();
    };
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
          onNewContact={openNewContact}
          onEditContact={openEditContact}
          onDeleteContact={openDeleteContact}
          onSelectConnection={selectConnection}
          onAddConnection={openAddConnection}
          onEditConnection={openEditConnection}
          onDeleteConnection={openDeleteConnection}
          onResizeConnections={connectionsColumns.resize}
          onStub={stub}
        />
      </div>
      {contactDialog?.kind === "edit" ? (
        <ContactDialog
          spec={contactDialog.spec}
          onAdded={reveal}
          onSaved={revealSavedOf(contactDialog.spec)}
          onCancel={closeContactDialog}
        />
      ) : null}
      {contactDialog?.kind === "delete" ? (
        <DeleteContactAlert
          contact={contactDialog.contact}
          refusal={deleting.refusal}
          onYes={confirmDeleteContact}
          onNo={closeContactDialog}
        />
      ) : null}
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

/** The person or company dialog over the screen: the New or Edit one, or the question before a delete. */
type ContactDialogOpen =
  | {
      kind: "edit";
      /** The kind of a new contact, or the contact it edits. */
      spec: ContactDialogSpec;
    }
  | {
      kind: "delete";
      contact: Contact;
    };

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

interface DeleteContactAlertProps {
  contact: Contact;
  /** Why the contacts port refused the delete; null when it did not. */
  refusal: Rejected | null;
  onYes: (contact: Contact) => void;
  onNo: () => void;
}

/** "Delete {name}? This cannot be undone.", and why it was refused. */
function DeleteContactAlert({
  contact,
  refusal,
  onYes,
  onNo,
}: DeleteContactAlertProps): ReactElement {
  const name = nameOf(contact);

  function yes(): void {
    onYes(contact);
  }

  return (
    <ConfirmAlert
      text={`Delete ${name}? This cannot be undone.`}
      error={refusal === null ? null : contactReasonText(refusal, name)}
      onYes={yes}
      onNo={onNo}
    />
  );
}
