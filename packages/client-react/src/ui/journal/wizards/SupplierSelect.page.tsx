import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { TESTIDS } from "#/ui/testids.ts";

import { SupplierSelect, type SupplierSelectProps } from "./SupplierSelect.tsx";

/** What a test can do with, and ask of, a supplier select. */
export interface SupplierSelectPage {
  isDisabled: () => boolean;
  /** The supplier drawn in the box. */
  drawnText: () => string;
  /** The note under the box, or null when there is none. */
  noteText: () => string | null;
  choose: (label: string) => Promise<void>;
}

export function mountSupplierSelect(
  props: Partial<SupplierSelectProps>,
): SupplierSelectPage {
  const user = userEvent.setup();
  const rendered = render(
    <SupplierSelect
      choices={[]}
      value={null}
      locked={false}
      onChange={vi.fn()}
      {...props}
    />,
  );

  function select(): HTMLSelectElement {
    return rendered.getByRole("combobox", {
      name: "Supplier",
    }) as HTMLSelectElement;
  }

  return {
    isDisabled: (): boolean => {
      return select().disabled;
    },
    drawnText: (): string => {
      return rendered.getByTestId(TESTIDS.wizardSelectText).textContent ?? "";
    },
    noteText: (): string | null => {
      const note = rendered.queryByTestId(TESTIDS.supplierSelectNote);

      return note === null ? null : (note.textContent ?? "");
    },
    choose: async (label: string): Promise<void> => {
      await user.selectOptions(select(), label);
    },
  };
}
