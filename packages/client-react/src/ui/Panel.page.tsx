import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Panel, type PanelProps } from "./Panel.tsx";
import { TESTIDS } from "./testids.ts";

/** What a test can do with, and ask of, a panel. */
export interface PanelPage {
  title: () => string;
  hasMaximize: () => boolean;
  maximizeLabel: () => string;
  clickMaximize: () => Promise<void>;
  meta: () => string | null;
  body: () => string;
}

export function mountPanel(props: PanelProps): PanelPage {
  const user = userEvent.setup();
  const rendered = render(<Panel {...props} />);

  return {
    title: (): string => {
      return rendered.getByTestId(TESTIDS.panelTitle).textContent ?? "";
    },
    hasMaximize: (): boolean => {
      return rendered.queryByTestId(TESTIDS.panelMaximize) !== null;
    },
    maximizeLabel: (): string => {
      return (
        rendered
          .getByTestId(TESTIDS.panelMaximize)
          .getAttribute("aria-label") ?? ""
      );
    },
    clickMaximize: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.panelMaximize));
    },
    meta: (): string | null => {
      return (
        rendered.container.querySelector(".panel-meta")?.textContent ?? null
      );
    },
    body: (): string => {
      return rendered.container.querySelector(".panel-body")?.textContent ?? "";
    },
  };
}
