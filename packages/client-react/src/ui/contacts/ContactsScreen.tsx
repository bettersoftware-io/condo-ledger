import { type ReactElement, useEffect, useRef } from "react";

import type { MaximizeIntents, MaximizeState } from "@cl/client-core";
import { type MachineView, useViewModel } from "@cl/react-bindings";

import { Splitter } from "../shell/Splitter.tsx";
import { TESTIDS } from "../testids.ts";
import { ContactsPanel } from "./ContactsPanel.tsx";
import { ContactTabs } from "./ContactTabs.tsx";
import { CONNECTIONS_COLUMN_SPECS, CONTACTS_COLUMN_SPECS } from "./columns.ts";
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
  const { view, select, setPage, setPageSize } = useContactsScreen();
  const columns = useColumns("contacts", CONTACTS_COLUMN_SPECS);
  const connectionsColumns = useColumns(
    "connections",
    CONNECTIONS_COLUMN_SPECS,
  );
  const split = useSplit("contacts");
  const tabs = useBottomTab("contacts", CONTACT_TABS);
  const { stub } = useNotices();
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
          connectionsTemplate={connectionsColumns.state.template}
          onActivate={tabs.activate}
          onResizeConnections={connectionsColumns.resize}
          onStub={stub}
        />
      </div>
    </div>
  );
}

export interface ContactsScreenProps {
  /** The shell's: which panel fills the screen, shared with the sidebar's rail. */
  maximize: MachineView<MaximizeState, MaximizeIntents>;
}
