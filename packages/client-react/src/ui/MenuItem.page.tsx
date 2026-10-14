import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { MenuItem, type MenuItemProps } from "./MenuItem.tsx";
import { TESTIDS } from "./testids.ts";

/** What a test can do with, and ask of, a menu item. */
export interface MenuItemPage {
  /** Whether assistive technology finds a menu item by this name. */
  isMenuItemNamed: (name: string) => boolean;
  /** The item as drawn, the icon's text before the label. */
  text: () => string;
  click: () => Promise<void>;
}

export function mountMenuItem(props: Partial<MenuItemProps>): MenuItemPage {
  const user = userEvent.setup();
  const rendered = render(
    <MenuItem label="Generic entry" onClick={vi.fn()} {...props} />,
  );

  return {
    isMenuItemNamed: (name: string): boolean => {
      return rendered.queryByRole("menuitem", { name }) !== null;
    },
    text: (): string => {
      return rendered.getByTestId(TESTIDS.menuItem).textContent ?? "";
    },
    click: async (): Promise<void> => {
      await user.click(rendered.getByTestId(TESTIDS.menuItem));
    },
  };
}
