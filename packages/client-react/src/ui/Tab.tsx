import type { ReactElement } from "react";

import "./TabbedPanel.css";

/** One tab of a tab list. Only the selected one is a stop for the Tab key; the list's arrow keys reach the others. */
export function Tab({
  id,
  name,
  selected,
  controls,
  onActivate,
}: TabProps): ReactElement {
  function activateTab(): void {
    onActivate(name);
  }

  return (
    <button
      id={id}
      type="button"
      role="tab"
      className="tabbed-tab"
      aria-selected={selected}
      aria-controls={selected ? controls : undefined}
      tabIndex={selected ? 0 : -1}
      onClick={activateTab}
    >
      {name}
    </button>
  );
}

export interface TabProps {
  id: string;
  name: string;
  selected: boolean;
  /** The id of the panel the tab shows when it is selected. */
  controls: string;
  onActivate: (tab: string) => void;
}
