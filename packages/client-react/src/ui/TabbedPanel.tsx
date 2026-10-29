import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useId,
} from "react";

import { Tab } from "./Tab.tsx";
import { tabAfterKey } from "./tabKeys.ts";

import "./TabbedPanel.css";

/**
 * Tabs on top of one body: the body is the active tab's content, chosen by the
 * caller, and named by that tab. The tab list is one stop for the Tab key;
 * the arrow keys, Home and End move between the tabs and activate the one
 * they reach (WAI-ARIA's tabs with automatic activation).
 */
export function TabbedPanel({
  label,
  tabs,
  active,
  onActivate,
  children,
}: TabbedPanelProps): ReactElement {
  const id = useId();
  const panelId = `${id}-panel`;
  const activeIndex = tabs.indexOf(active);

  function moveOnKey(event: KeyboardEvent<HTMLDivElement>): void {
    const next = tabAfterKey(event.key, activeIndex, tabs.length);
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
      <div
        className="tabbed-tabs"
        role="tablist"
        aria-label={label}
        onKeyDown={moveOnKey}
      >
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
  /** The tab list's accessible name: what its tabs show views of. */
  label: string;
  tabs: readonly string[];
  active: string;
  onActivate: (tab: string) => void;
  children: ReactNode;
}

function tabIdOf(panelId: string, index: number): string {
  return `${panelId}-tab-${index}`;
}
