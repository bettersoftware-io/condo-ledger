import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { SelectableList, type SelectableListProps } from "./SelectableList.tsx";
import { TESTIDS } from "./testids.ts";

/** What a test can do with, and ask of, a selectable list. */
export interface SelectableListPage {
  /** Whether assistive technology finds a radio group by this name. */
  isGroupNamed: (name: string) => boolean;
  /** Each row as drawn, the icon's text before the label. */
  rows: () => string[];
  /** The key of the checked radio, or null when none is. */
  checked: () => string | null;
  /** The text of the row drawn as selected, or null when none is. */
  drawnSelected: () => string | null;
  /** Clicks the item whose radio has this accessible name. */
  choose: (label: string) => Promise<void>;
  /** Moves the focus onto the item whose radio has this accessible name. */
  focus: (label: string) => void;
  press: (key: string) => Promise<void>;
}

export function mountSelectableList(
  props: Partial<SelectableListProps>,
): SelectableListPage {
  const user = userEvent.setup();
  const rendered = render(
    <SelectableList
      label="Cost account"
      items={[]}
      selectedKey={null}
      onSelect={vi.fn()}
      {...props}
    />,
  );

  function rows(): HTMLElement[] {
    return rendered.queryAllByTestId(TESTIDS.selectableItem);
  }

  function radio(label: string): HTMLInputElement {
    return rendered.getByRole("radio", { name: label }) as HTMLInputElement;
  }

  return {
    isGroupNamed: (name: string): boolean => {
      return rendered.queryByRole("radiogroup", { name }) !== null;
    },
    rows: (): string[] => {
      return rows().map((row) => {
        return row.textContent ?? "";
      });
    },
    checked: (): string | null => {
      return (
        rendered
          .queryByRole("radio", { checked: true })
          ?.getAttribute("value") ?? null
      );
    },
    drawnSelected: (): string | null => {
      const row = rows().find((candidate) => {
        return candidate.dataset.selected === "true";
      });

      return row?.textContent ?? null;
    },
    choose: async (label: string): Promise<void> => {
      await user.click(radio(label));
    },
    focus: (label: string): void => {
      radio(label).focus();
    },
    press: async (key: string): Promise<void> => {
      await user.keyboard(`{${key}}`);
    },
  };
}
