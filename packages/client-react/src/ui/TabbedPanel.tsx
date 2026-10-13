import type { ReactElement, ReactNode } from "react";

import { Tab } from "./Tab.tsx";

import "./TabbedPanel.css";

/** Tabs on top of one body: the body is the active tab's content, chosen by the caller. */
export function TabbedPanel({
  tabs,
  active,
  onActivate,
  children,
}: TabbedPanelProps): ReactElement {
  return (
    <div className="tabbed">
      <div className="tabbed-tabs" role="tablist">
        {tabs.map((tab) => {
          return (
            <Tab
              key={tab}
              name={tab}
              selected={tab === active}
              onActivate={onActivate}
            />
          );
        })}
      </div>
      <div className="tabbed-body" role="tabpanel">
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
