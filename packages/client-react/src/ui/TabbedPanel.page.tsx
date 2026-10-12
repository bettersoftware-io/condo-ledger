import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TabbedPanel, type TabbedPanelProps } from "./TabbedPanel.tsx";

/** What a test can do with, and ask of, a tabbed panel. */
export interface TabbedPanelPage {
  activeTab: () => string;
  activate: (name: string) => Promise<void>;
  body: () => string;
}

export function mountTabbedPanel(props: TabbedPanelProps): TabbedPanelPage {
  const user = userEvent.setup();
  const rendered = render(<TabbedPanel {...props} />);

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
  };
}
