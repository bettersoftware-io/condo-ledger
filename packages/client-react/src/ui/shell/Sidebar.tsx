import { type ReactElement, useEffect, useRef } from "react";

import { useViewModel } from "@cl/react-bindings";

import { TESTIDS } from "../testids.ts";
import { BuildingsTree } from "./BuildingsTree.tsx";
import { ManagementMenu } from "./ManagementMenu.tsx";
import { Rail } from "./Rail.tsx";
import { Splitter } from "./Splitter.tsx";

import "./Sidebar.css";

/**
 * The Buildings module's sidebar: the buildings and their periods, the
 * management menu, the splitter that sizes it, and the rail that stands in
 * for it when folded. Reads the tree, the selection, the navigation and the
 * notices; its size and fold come from the shell, which keeps them while the
 * person visits another module. Below 1180px the stylesheet makes it a drawer
 * over the main area and shows the rail; nothing here measures the window.
 */
export function Sidebar({
  width,
  open,
  maximized,
  onResize,
  onOpen,
  onClose,
  onRestore,
}: SidebarProps): ReactElement {
  const { useBuildingsTree, useSelectedPeriod, useNavigation, useNotices } =
    useViewModel();
  const buildings = useBuildingsTree();
  const { selected, selectPeriod } = useSelectedPeriod();
  const navigation = useNavigation();
  const { stub } = useNotices();
  const aside = useRef<HTMLElement>(null);

  useEffect(() => {
    aside.current?.style.setProperty("--sidebar-width", `${width}px`);
  }, [width]);

  function resizeBy(deltaPx: number): void {
    onResize(width + deltaPx);
  }

  function stubAddManagement(): void {
    stub("Add management");
  }

  function stubEditManagement(): void {
    stub("Edit management");
  }

  function stubDeleteManagement(): void {
    stub("Delete management");
  }

  function stubRefresh(): void {
    stub("Refresh");
  }

  return (
    <>
      <Rail onOpen={maximized ? onRestore : onOpen} />
      <aside
        ref={aside}
        className="sidebar"
        data-open={open}
        data-testid={TESTIDS.sidebar}
      >
        <section className="sidebar-card sidebar-card-grow">
          <header className="sidebar-card-header">Select Management</header>
          <div className="sidebar-tools">
            <button
              type="button"
              className="sidebar-tool"
              data-tone="ok"
              aria-label="Add management"
              onClick={stubAddManagement}
            >
              +
            </button>
            <button
              type="button"
              className="sidebar-tool"
              data-tone="muted"
              aria-label="Edit management"
              onClick={stubEditManagement}
            >
              ✎
            </button>
            <button
              type="button"
              className="sidebar-tool"
              data-tone="neg"
              aria-label="Delete management"
              onClick={stubDeleteManagement}
            >
              −
            </button>
            <span className="sidebar-tools-spacer" />
            <button
              type="button"
              className="sidebar-tool"
              data-tone="muted"
              aria-label="Refresh"
              onClick={stubRefresh}
            >
              ⟳
            </button>
          </div>
          <div className="sidebar-card-body">
            <BuildingsTree
              buildings={buildings}
              selectedPeriodId={selected?.periodId ?? null}
              onSelectPeriod={selectPeriod}
            />
          </div>
        </section>
        <section className="sidebar-card">
          <header className="sidebar-card-header">Management Menu</header>
          <ManagementMenu
            active={navigation.state.menu}
            onSelect={navigation.selectMenu}
          />
        </section>
      </aside>
      <Splitter direction="vertical" onDrag={resizeBy} />
      <button
        type="button"
        className="drawer-scrim"
        data-open={open}
        data-testid={TESTIDS.drawerScrim}
        aria-label="Close management"
        tabIndex={-1}
        onClick={onClose}
      />
    </>
  );
}

export interface SidebarProps {
  width: number;
  /** The drawer, in compact mode. */
  open: boolean;
  /** A panel of the main area fills the screen: the rail stands in for the sidebar. */
  maximized: boolean;
  onResize: (px: number) => void;
  onOpen: () => void;
  onClose: () => void;
  onRestore: () => void;
}
