import { type ReactElement, useEffect, useRef } from "react";

import type { MaximizeIntents, MaximizeState } from "@cl/client-core";
import { type MachineView, useViewModel } from "@cl/react-bindings";

import { Panel } from "../Panel.tsx";
import { Splitter } from "../shell/Splitter.tsx";
import { TabbedPanel } from "../TabbedPanel.tsx";
import { TESTIDS } from "../testids.ts";
import { AccountDetails } from "./AccountDetails.tsx";
import { AccountsGrid } from "./AccountsGrid.tsx";
import { AccountsToolbar } from "./AccountsToolbar.tsx";
import { ACCOUNTS_COLUMN_SPECS } from "./columns.ts";
import { LedgerTab } from "./LedgerTab.tsx";

import "./AccountsScreen.css";

/**
 * Accounts, Ledgers & Balance: the chart of accounts over the selected
 * account's details or ledger, split by a splitter. Reads the view model and
 * hands plain props down. The maximize machine is the shell's, so a
 * maximized panel also folds the sidebar. The split reaches the stylesheet as
 * `--split-ratio`, written in an effect as the tree grid writes its template.
 */
export function AccountsScreen({
  maximize,
}: AccountsScreenProps): ReactElement {
  const {
    useAccountsGrid,
    useColumns,
    useSelectedAccount,
    useSplit,
    useBottomTab,
    useNotices,
    useSetBudget,
  } = useViewModel();
  const grid = useAccountsGrid();
  const columns = useColumns(ACCOUNTS_COLUMN_SPECS);
  const selection = useSelectedAccount();
  const split = useSplit();
  const tabs = useBottomTab(BOTTOM_TABS);
  const { stub } = useNotices();
  const setBudget = useSetBudget();
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
      className="accounts-screen"
      data-testid={TESTIDS.accountsScreen}
      data-maximized={maximized ?? "none"}
    >
      <div className="accounts-top">
        <Panel
          title="Accounts, Ledgers & Balance"
          meta="ⓘ Legend"
          maximized={maximized === "top"}
          onToggleMaximize={toggleTopMaximized}
        >
          <div className="accounts-top-body">
            <AccountsToolbar
              search={grid.state.search}
              hideEmpty={grid.state.hideEmpty}
              onSearch={grid.setSearch}
              onHideEmpty={grid.setHideEmpty}
              onExpandAll={grid.expandAll}
              onCollapseAll={grid.collapseAll}
              onStub={stub}
            />
            <div className="accounts-grid">
              <AccountsGrid
                rows={grid.state.rows}
                selectedKey={selection.key}
                template={columns.state.template}
                onToggle={grid.toggle}
                onSelect={selection.select}
                onResize={columns.resize}
                onSetBudget={setBudget}
              />
            </div>
          </div>
        </Panel>
      </div>
      <Splitter direction="horizontal" onDrag={moveSplitBy} />
      <div className="accounts-bottom">
        <TabbedPanel
          tabs={BOTTOM_TABS}
          active={tabs.state.active}
          onActivate={tabs.activate}
        >
          <div className="accounts-tab-body">
            {tabs.state.active === "Ledger" ? (
              <LedgerTab />
            ) : (
              <AccountDetails />
            )}
          </div>
        </TabbedPanel>
      </div>
    </div>
  );
}

export interface AccountsScreenProps {
  /** The shell's: which panel fills the screen, shared with the sidebar's rail. */
  maximize: MachineView<MaximizeState, MaximizeIntents>;
}

const BOTTOM_TABS = ["Account Details", "Ledger"] as const;
