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
 * here measures the window. Takes only props. On the right (the Calendar's
 * deadlines column) it is mirrored: the splitter, the aside and the rail
 * stand in that order, and the drawer opens from the right edge.
 */
export function SidebarFrame({
  width,
  open,
  maximized,
  railLabel,
  railTitle,
  side = "left",
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

  /** Dragging away from the main area widens the frame: to the right for a left frame, to the left for a right one. */
  function resizeBy(deltaPx: number): void {
    onResize(width + (side === "left" ? deltaPx : -deltaPx));
  }

  const rail = (
    <Rail
      label={railLabel}
      title={railTitle}
      side={side}
      onOpen={maximized ? onRestore : onOpen}
    />
  );

  const panel = (
    <aside
      ref={aside}
      className="sidebar"
      data-side={side}
      data-open={open}
      data-testid={side === "left" ? TESTIDS.sidebar : TESTIDS.sidebarRight}
    >
      {children}
    </aside>
  );
  const splitter = <Splitter direction="vertical" onDrag={resizeBy} />;

  const before = side === "left" ? rail : splitter;
  const after = side === "left" ? splitter : rail;

  return (
    <>
      {before}
      {panel}
      {after}
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
  /** The edge it stands at: the Buildings and Contacts sidebars on the left, the Calendar's column on the right. Left by default. */
  side?: "left" | "right";
  onResize: (px: number) => void;
  onOpen: () => void;
  onClose: () => void;
  onRestore: () => void;
  children: ReactNode;
}
