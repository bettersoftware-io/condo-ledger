import { type ReactElement, type ReactNode, useEffect, useRef } from "react";

import { TESTIDS } from "../testids.ts";
import { Rail } from "./Rail.tsx";
import { Splitter } from "./Splitter.tsx";

import "./Sidebar.css";

/**
 * The frame of the shell's sidebar, whatever it holds: the rail that stands in
 * for it when folded, the aside with the width the shell keeps, the splitter
 * that sizes it, and the scrim that closes it as a drawer. Below 1180px the
 * stylesheet makes it a drawer over the main area and shows the rail; nothing
 * here measures the window. Takes only props.
 */
export function SidebarFrame({
  width,
  open,
  maximized,
  railLabel,
  railTitle,
  onResize,
  onOpen,
  onClose,
  onRestore,
  children,
}: SidebarFrameProps): ReactElement {
  const aside = useRef<HTMLElement>(null);

  useEffect(() => {
    aside.current?.style.setProperty("--sidebar-width", `${width}px`);
  }, [width]);

  function resizeBy(deltaPx: number): void {
    onResize(width + deltaPx);
  }

  return (
    <>
      <Rail
        label={railLabel}
        title={railTitle}
        onOpen={maximized ? onRestore : onOpen}
      />
      <aside
        ref={aside}
        className="sidebar"
        data-open={open}
        data-testid={TESTIDS.sidebar}
      >
        {children}
      </aside>
      <Splitter direction="vertical" onDrag={resizeBy} />
      <button
        type="button"
        className="drawer-scrim"
        data-open={open}
        data-testid={TESTIDS.drawerScrim}
        aria-label={`Close ${railLabel.toLowerCase()}`}
        tabIndex={-1}
        onClick={onClose}
      />
    </>
  );
}

export interface SidebarFrameProps {
  width: number;
  /** The drawer, in compact mode. */
  open: boolean;
  /** A panel of the main area fills the screen: the rail stands in for the sidebar. */
  maximized: boolean;
  /** What the rail reads, in capitals: MANAGEMENT, FILTERS. */
  railLabel: string;
  /** The rail's tooltip and accessible name: "Open management". */
  railTitle: string;
  onResize: (px: number) => void;
  onOpen: () => void;
  onClose: () => void;
  onRestore: () => void;
  children: ReactNode;
}
