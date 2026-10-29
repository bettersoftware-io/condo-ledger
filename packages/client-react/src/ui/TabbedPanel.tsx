import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useId,
} from "react";

import { Tab } from "./Tab.tsx";

import "./TabbedPanel.css";

/**
 * Tabs on top of one body: the body is the active tab's content, chosen by the
 * caller, and named by that tab. The tab list is one stop for the Tab key;
 * the arrow keys, Home and End move between the tabs and activate the one
 * they reach (WAI-ARIA's tabs with automatic activation).
 */
export function TabbedPanel({
  tabs,
  active,
  onActivate,
  children,
}: TabbedPanelProps): ReactElement {
  const id = useId();
  const panelId = `${id}-panel`;
  const activeIndex = tabs.indexOf(active);

  function moveOnKey(event: KeyboardEvent<HTMLDivElement>): void {
    const next = nextIndex(event.key, activeIndex, tabs.length);
    const tab = next === null ? null : (tabs[next] ?? null);

    if (next === null || tab === null) {
      return;
    }

    event.preventDefault();
    document.getElementById(tabIdOf(id, next))?.focus();
    onActivate(tab);
  }

  return (
    <div className="tabbed">
      <div className="tabbed-tabs" role="tablist" onKeyDown={moveOnKey}>
        {tabs.map((tab, index) => {
          return (
            <Tab
              key={tab}
              id={tabIdOf(id, index)}
              name={tab}
              selected={index === activeIndex}
              controls={panelId}
              onActivate={onActivate}
            />
          );
        })}
      </div>
      <div
        id={panelId}
        className="tabbed-body"
        role="tabpanel"
        aria-labelledby={tabIdOf(id, activeIndex)}
      >
        {children}
      </div>
    </div>
  );
}

export interface TabbedPanelProps {
  tabs: readonly string[];
  active: string;
  onActivate: (tab: string) => void;
  children: ReactNode;
}

function tabIdOf(panelId: string, index: number): string {
  return `${panelId}-tab-${index}`;
}

/** The tab a key moves to from the active one, wrapping at the ends; null for a key that moves nothing. */
function nextIndex(key: string, from: number, count: number): number | null {
  switch (key) {
    case "ArrowRight":
      return (from + 1) % count;
    case "ArrowLeft":
      return (from - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
