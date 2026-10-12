import type { ReactElement } from "react";

import type { NavigationState } from "@cl/client-core";

import { MODULE_TABS } from "./labels.tsx";

import "./TopBar.css";

/** The three module tabs at the foot of the top bar; the active one opens onto the body below. */
export function ModuleTabs({
  active,
  onSelect,
}: ModuleTabsProps): ReactElement {
  function selectingModule(module: Module): () => void {
    return (): void => {
      onSelect(module);
    };
  }

  return (
    <div className="module-tabs" role="tablist" aria-label="Modules">
      {MODULE_TABS.map((tab) => {
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className="module-tab"
            aria-selected={tab.id === active}
            onClick={selectingModule(tab.id)}
          >
            <svg
              className="module-tab-dot"
              width="7"
              height="7"
              viewBox="0 0 7 7"
              aria-hidden="true"
            >
              <circle cx="3.5" cy="3.5" r="3.5" fill={tab.color} />
            </svg>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

type Module = NavigationState["module"];

export interface ModuleTabsProps {
  active: Module;
  onSelect: (module: Module) => void;
}
