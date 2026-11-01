import { Printer } from "lucide-react";
import { type ReactElement, useState } from "react";

import type { ContactsView } from "@cl/client-core";
import type { ContactView } from "@cl/domain";

import { LegendButton } from "../allocation/LegendButton.tsx";
import { CONTACT_KIND_ICONS } from "../contactLabels.ts";
import { MenuItem } from "../MenuItem.tsx";
import { PDF_GLYPH, XLS_GLYPH } from "../shell/icons.tsx";
import { Popover } from "../shell/Popover.tsx";
import { TabbedPanel } from "../TabbedPanel.tsx";
import { Toolbar } from "../Toolbar.tsx";
import { ToolbarButton } from "../ToolbarButton.tsx";
import { ToolbarDivider } from "../ToolbarDivider.tsx";
import { TESTIDS } from "../testids.ts";
import { ConnectedContacts } from "./ConnectedContacts.tsx";
import { ContactDetails } from "./ContactDetails.tsx";
import { CONTACT_TABS, NO_CONTACT_MATCHES } from "./labels.ts";

import "./ContactTabs.css";

/**
 * The Contacts screen's bottom panel: the Contact Details and Connected
 * Contacts tabs of the selected contact under one toolbar. On Contact Details
 * `+ ▾` offers a new person or company, and ✎ and − act on the contact; on
 * Connected Contacts `+`, ✎ and − act on its connections. Each, with print,
 * export and the Legend, posts its notice for now. With no contact the tabs
 * say "No contact matches.". Which menu is open is this view's own state.
 * Takes only props, so the compiler memoizes it.
 */
export function ContactTabs({
  active,
  contact,
  uses,
  connections,
  connectionsTemplate,
  onActivate,
  onResizeConnections,
  onStub,
}: ContactTabsProps): ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);
  const connected = active === "Connected Contacts";
  const noContact = contact === null;

  function stubbing(label: string): () => void {
    return (): void => {
      onStub(label);
    };
  }

  function stubbingFromMenu(label: string): () => void {
    return (): void => {
      setMenuOpen(false);
      onStub(label);
    };
  }

  function openMenu(): void {
    setMenuOpen(true);
  }

  function closeMenu(): void {
    setMenuOpen(false);
  }

  return (
    <div className="contact-tabs" data-testid={TESTIDS.contactTabs}>
      <TabbedPanel
        label="Selected contact"
        tabs={CONTACT_TABS}
        active={active}
        onActivate={onActivate}
      >
        <div className="contact-tabs-body">
          <Toolbar>
            {connected ? (
              <>
                <ToolbarButton
                  label="Add connection"
                  icon="+"
                  tone="ok"
                  iconOnly
                  disabled={noContact}
                  onClick={stubbing("Add connection")}
                />
                <ToolbarButton
                  label="Edit connection"
                  icon="✎"
                  tone="muted"
                  iconOnly
                  disabled={noContact}
                  onClick={stubbing("Edit connection")}
                />
                <ToolbarButton
                  label="Delete connection"
                  icon="−"
                  tone="neg"
                  iconOnly
                  disabled={noContact}
                  onClick={stubbing("Delete connection")}
                />
              </>
            ) : (
              <>
                <div className="contact-tabs-menu-anchor">
                  <ToolbarButton
                    label="Add contact"
                    icon="+"
                    text="▾"
                    tone="ok"
                    menuOpen={menuOpen}
                    onClick={openMenu}
                  />
                  <Popover
                    open={menuOpen}
                    label="Add contact"
                    onClose={closeMenu}
                  >
                    <MenuItem
                      label="New person"
                      icon={CONTACT_KIND_ICONS.person}
                      onClick={stubbingFromMenu("New person")}
                    />
                    <MenuItem
                      label="New company"
                      icon={CONTACT_KIND_ICONS.company}
                      onClick={stubbingFromMenu("New company")}
                    />
                  </Popover>
                </div>
                <ToolbarButton
                  label="Edit contact"
                  icon="✎"
                  tone="muted"
                  iconOnly
                  disabled={noContact}
                  onClick={stubbing("Edit contact")}
                />
                <ToolbarButton
                  label="Delete contact"
                  icon="−"
                  tone="neg"
                  iconOnly
                  disabled={noContact}
                  onClick={stubbing("Delete contact")}
                />
              </>
            )}
            <ToolbarDivider />
            <ToolbarButton
              label="Print"
              icon={<Printer size={14} />}
              tone="muted"
              iconOnly
              onClick={stubbing("Print")}
            />
            <ToolbarButton
              label="Export to PDF"
              icon={PDF_GLYPH}
              iconOnly
              onClick={stubbing("Export to PDF")}
            />
            <ToolbarButton
              label="Export to Excel"
              icon={XLS_GLYPH}
              iconOnly
              onClick={stubbing("Export to Excel")}
            />
            <span className="contact-tabs-spacer" />
            <LegendButton onStub={onStub} />
          </Toolbar>
          <div className="contact-tabs-content">
            {contact === null || uses === null ? (
              <p className="contact-tabs-hint">{NO_CONTACT_MATCHES}</p>
            ) : connected ? (
              <ConnectedContacts
                connections={connections}
                template={connectionsTemplate}
                onResize={onResizeConnections}
              />
            ) : (
              <ContactDetails contact={contact} uses={uses} />
            )}
          </div>
        </div>
      </TabbedPanel>
    </div>
  );
}

export interface ContactTabsProps {
  /** The tab in front: one of CONTACT_TABS. */
  active: string;
  /** The selected contact; null with none. */
  contact: ContactView | null;
  /** Where it is used; null with no contact. */
  uses: ContactsView["uses"];
  /** Its connections, by order. */
  connections: ContactsView["connections"];
  /** The connections' grid-template-columns, from its columns machine. */
  connectionsTemplate: string;
  onActivate: (tab: string) => void;
  onResizeConnections: (index: number, px: number) => void;
  /** A tool that is not built yet, by name. */
  onStub: (label: string) => void;
}
