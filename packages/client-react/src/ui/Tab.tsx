import type { ReactElement } from "react";

import "./TabbedPanel.css";

export function Tab({ name, selected, onActivate }: TabProps): ReactElement {
  function activateTab(): void {
    onActivate(name);
  }

  return (
    <button
      type="button"
      role="tab"
      className="tabbed-tab"
      aria-selected={selected}
      onClick={activateTab}
    >
      {name}
    </button>
  );
}

export interface TabProps {
  name: string;
  selected: boolean;
  onActivate: (tab: string) => void;
}
