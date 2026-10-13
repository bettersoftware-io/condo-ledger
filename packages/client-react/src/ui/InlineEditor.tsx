import {
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useRef,
} from "react";

import { TESTIDS } from "./testids.ts";

import "./InlineEditor.css";

/**
 * A text input focused on mount: Enter and blur commit, Escape cancels. A
 * text is committed once: the blur after Enter commits nothing, until the
 * text is changed again (after a rejection, say).
 */
export function InlineEditor({
  value,
  error,
  onCommit,
  onCancel,
}: InlineEditorProps): ReactElement {
  const input = useRef<HTMLInputElement>(null);
  const settled = useRef(false);

  useEffect(() => {
    input.current?.focus();
  }, []);

  function commit(): void {
    if (settled.current) {
      return;
    }

    settled.current = true;
    onCommit(input.current?.value ?? value);
  }

  function unsettle(): void {
    settled.current = false;
  }

  function commitOrCancelOnKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      commit();
    } else if (event.key === "Escape") {
      settled.current = true;
      onCancel();
    }
  }

  return (
    <>
      <input
        ref={input}
        className="inline-editor"
        data-testid={TESTIDS.inlineEditor}
        defaultValue={value}
        onChange={unsettle}
        onKeyDown={commitOrCancelOnKey}
        onBlur={commit}
      />
      {error === null ? null : (
        <div
          className="inline-editor-error"
          data-testid={TESTIDS.inlineEditorError}
        >
          {error}
        </div>
      )}
    </>
  );
}

export interface InlineEditorProps {
  value: string;
  error: string | null;
  onCommit: (text: string) => void;
  onCancel: () => void;
}
