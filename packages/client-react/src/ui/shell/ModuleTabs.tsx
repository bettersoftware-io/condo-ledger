import { type KeyboardEvent, type ReactElement, useId } from "react";

import type { NavigationState } from "@cl/client-core";

import { tabAfterKey } from "../tabKeys.ts";
import { MODULE_TABS } from "./labels.tsx";

import "./TopBar.css";

/**
 * The three module tabs at the foot of the top bar; the active one opens onto
 * the body below. A named tab list after WAI-ARIA's tabs: one stop for the
 * Tab key, the active tab; the arrow keys, Home and End move between the tabs
 * and open the one they reach.
 */
export function ModuleTabs({
  active,
  onSelect,
}: ModuleTabsProps): ReactElement {
  const id = useId();
  const activeIndex = MODULE_TABS.findIndex((tab) => {
    return tab.id === active;
  });

  function selectingModule(module: Module): () => void {
    return (): void => {
      onSelect(module);
    };
  }

  function moveOnKey(event: KeyboardEvent<HTMLDivElement>): void {
    const next = tabAfterKey(event.key, activeIndex, MODULE_TABS.length);
    const tab = next === null ? null : (MODULE_TABS[next] ?? null);

    if (next === null || tab === null) {
      return;
    }

    event.preventDefault();
    document.getElementById(tabIdOf(id, next))?.focus();
    onSelect(tab.id);
  }

  return (
    <div
      className="module-tabs"
      role="tablist"
      aria-label="Modules"
      onKeyDown={moveOnKey}
    >
      {MODULE_TABS.map((tab, index) => {
        const selected = tab.id === active;

        return (
          <button
            key={tab.id}
            id={tabIdOf(id, index)}
            type="button"
            role="tab"
            className="module-tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
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

function tabIdOf(listId: string, index: number): string {
  return `${listId}-tab-${index}`;
}
