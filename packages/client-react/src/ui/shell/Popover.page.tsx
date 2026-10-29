import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement, useState } from "react";

import { MenuItem } from "../MenuItem.tsx";
import { Popover } from "./Popover.tsx";

/** What a test can do with, and ask of, a popover menu hanging from its button. */
export interface PopoverPage {
  /** Clicks the button that opens the menu. */
  open: () => Promise<void>;
  /** Puts the focus on the menu's button and presses Enter there. */
  openFromKeyboard: () => Promise<void>;
  isOpen: () => boolean;
  /** Presses a key where the focus is. */
  press: (key: string) => Promise<void>;
  /** The name of the menu item that has the keyboard's focus; null when none has it. */
  focusedItem: () => string | null;
  /** Clicks a menu item by its name. */
  pick: (name: string) => Promise<void>;
  clickOutside: () => Promise<void>;
  /** Whether the button that opened the menu has the focus. */
  buttonHasFocus: () => boolean;
  /** The items picked, by name, in order. */
  picked: () => string[];
}

/** Mounts a button and the menu it opens, with these items, after a field the Tab key can reach. */
export function mountPopover(items: readonly string[]): PopoverPage {
  const user = userEvent.setup();
  const picked: string[] = [];

  function record(name: string): void {
    picked.push(name);
  }

  const rendered = render(<PopoverHost items={items} onPick={record} />);

  function button(): HTMLElement {
    return rendered.getByRole("button", { name: BUTTON });
  }

  return {
    open: async (): Promise<void> => {
      await user.click(button());
    },
    openFromKeyboard: async (): Promise<void> => {
      button().focus();
      await user.keyboard("{Enter}");
    },
    isOpen: (): boolean => {
      return rendered.queryByRole("menu") !== null;
    },
    press: async (key: string): Promise<void> => {
      await user.keyboard(`{${key}}`);
    },
    focusedItem: (): string | null => {
      const focused = rendered.queryAllByRole("menuitem").find((item) => {
        return item === document.activeElement;
      });

      return focused?.textContent ?? null;
    },
    pick: async (name: string): Promise<void> => {
      await user.click(rendered.getByRole("menuitem", { name }));
    },
    clickOutside: async (): Promise<void> => {
      await user.click(rendered.getByRole("button", { name: `Close ${MENU}` }));
    },
    buttonHasFocus: (): boolean => {
      return document.activeElement === button();
    },
    picked: (): string[] => {
      return [...picked];
    },
  };
}

const BUTTON = "Add";

const MENU = "Add transaction";

interface PopoverHostProps {
  items: readonly string[];
  onPick: (name: string) => void;
}

/** The button and its menu as a toolbar holds them: a pick closes the menu. */
function PopoverHost({ items, onPick }: PopoverHostProps): ReactElement {
  const [open, setOpen] = useState(false);

  function openMenu(): void {
    setOpen(true);
  }

  function closeMenu(): void {
    setOpen(false);
  }

  function picking(name: string): () => void {
    return (): void => {
      setOpen(false);
      onPick(name);
    };
  }

  return (
    <div>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={openMenu}
      >
        {BUTTON}
      </button>
      <Popover open={open} label={MENU} onClose={closeMenu}>
        {items.map((item) => {
          return <MenuItem key={item} label={item} onClick={picking(item)} />;
        })}
      </Popover>
      <input aria-label="After the menu" />
    </div>
  );
}
