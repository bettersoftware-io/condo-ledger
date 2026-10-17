import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  SegmentedControl,
  type SegmentedControlProps,
} from "./SegmentedControl.tsx";
import { TESTIDS } from "./testids.ts";

/** What a test can do with, and ask of, a segmented control. */
export interface SegmentedControlPage {
  /** Whether assistive technology finds a radio group by this name. */
  isGroupNamed: (name: string) => boolean;
  /** The pills' labels, in order. */
  labels: () => string[];
  /** The label of the pill drawn as chosen, or null when none is. */
  drawnSelected: () => string | null;
  /** Clicks the pill with this label. */
  choose: (label: string) => Promise<void>;
  /** Puts the focus on the pill with this label and presses a key. */
  pressOn: (label: string, key: string) => Promise<void>;
}

export function mountSegmentedControl(
  props: SegmentedControlProps<string>,
): SegmentedControlPage {
  const user = userEvent.setup();
  const rendered = render(<SegmentedControl {...props} />);

  function pills(): HTMLElement[] {
    return rendered.queryAllByTestId(TESTIDS.segment);
  }

  return {
    isGroupNamed: (name: string): boolean => {
      return rendered.queryByRole("radiogroup", { name }) !== null;
    },
    labels: (): string[] => {
      return pills().map((pill) => {
        return pill.textContent ?? "";
      });
    },
    drawnSelected: (): string | null => {
      const chosen = pills().find((pill) => {
        return pill.dataset.selected === "true";
      });

      return chosen === undefined ? null : (chosen.textContent ?? "");
    },
    choose: async (label: string): Promise<void> => {
      await user.click(rendered.getByRole("radio", { name: label }));
    },
    pressOn: async (label: string, key: string): Promise<void> => {
      rendered.getByRole("radio", { name: label }).focus();
      await user.keyboard(key);
    },
  };
}
