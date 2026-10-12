import { fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { InlineEditor, type InlineEditorProps } from "./InlineEditor.tsx";
import { TESTIDS } from "./testids.ts";

/** What a test can do with, and ask of, an inline editor. */
export interface InlineEditorPage {
  type: (text: string) => Promise<void>;
  pressEnter: () => void;
  pressEscape: () => void;
  blur: () => void;
  errorText: () => string | null;
  isFocused: () => boolean;
}

export function mountInlineEditor(
  props: Partial<InlineEditorProps>,
): InlineEditorPage {
  const user = userEvent.setup();
  const rendered = render(
    <InlineEditor
      value=""
      error={null}
      onCommit={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />,
  );

  function input(): HTMLElement {
    return rendered.getByTestId(TESTIDS.inlineEditor);
  }

  return {
    type: async (text: string): Promise<void> => {
      await user.clear(input());
      await user.type(input(), text);
    },
    pressEnter: (): void => {
      fireEvent.keyDown(input(), { key: "Enter" });
    },
    pressEscape: (): void => {
      fireEvent.keyDown(input(), { key: "Escape" });
    },
    blur: (): void => {
      fireEvent.blur(input());
    },
    errorText: (): string | null => {
      return (
        rendered.queryByTestId(TESTIDS.inlineEditorError)?.textContent ?? null
      );
    },
    isFocused: (): boolean => {
      return document.activeElement === input();
    },
  };
}
