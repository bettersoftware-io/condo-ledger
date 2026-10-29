import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TabbedPanel, type TabbedPanelProps } from "./TabbedPanel.tsx";

/** What a test can do with, and ask of, a tabbed panel. */
export interface TabbedPanelPage {
  activeTab: () => string;
  activate: (name: string) => Promise<void>;
  body: () => string;
  /** The panel's accessible name: the tab that labels it. */
  panelName: () => string;
  /** The tabs the Tab key stops on, by name. */
  tabStops: () => string[];
  /** Puts the focus on the active tab and presses a key there. */
  pressOnActiveTab: (key: string) => Promise<void>;
  /** The name of the tab that has the keyboard's focus; null when no tab has it. */
  focusedTab: () => string | null;
}

export function mountTabbedPanel(props: TabbedPanelProps): TabbedPanelPage {
  const user = userEvent.setup();
  const rendered = render(<TabbedPanel {...props} />);

  function tabs(): HTMLElement[] {
    return rendered.getAllByRole("tab");
  }

  return {
    activeTab: (): string => {
      return rendered.getByRole("tab", { selected: true }).textContent ?? "";
    },
    activate: async (name: string): Promise<void> => {
      await user.click(rendered.getByRole("tab", { name }));
    },
    body: (): string => {
      return rendered.getByRole("tabpanel").textContent ?? "";
    },
    panelName: (): string => {
      const panel = rendered.getByRole("tabpanel");
      const labelledBy = panel.getAttribute("aria-labelledby") ?? "";

      return document.getElementById(labelledBy)?.textContent ?? "";
    },
    tabStops: (): string[] => {
      return tabs()
        .filter((tab) => {
          return tab.tabIndex === 0;
        })
        .map((tab) => {
          return tab.textContent ?? "";
        });
    },
    pressOnActiveTab: async (key: string): Promise<void> => {
      rendered.getByRole("tab", { selected: true }).focus();
      await user.keyboard(`{${key}}`);
    },
    focusedTab: (): string | null => {
      const focused = tabs().find((tab) => {
        return tab === document.activeElement;
      });

      return focused?.textContent ?? null;
    },
  };
}
