import {
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useId,
  useRef,
} from "react";

import { TESTIDS } from "./testids.ts";

import "./InlineEditor.css";

/**
 * A text input focused on mount: Enter and blur commit, Escape cancels. A
 * text is committed once: the blur after Enter commits nothing, until the
 * text is changed again (after a rejection, say). It is named by `label`, as
 * it stands in a cell with no visible label of its own; an error marks it
 * invalid and is announced as it appears.
 */
export function InlineEditor({
  label,
  value,
  error,
  onCommit,
  onCancel,
}: InlineEditorProps): ReactElement {
  const input = useRef<HTMLInputElement>(null);
  const settled = useRef(false);
  const errorId = useId();

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
        aria-label={label}
        aria-invalid={error !== null}
        aria-describedby={error === null ? undefined : errorId}
        defaultValue={value}
        onChange={unsettle}
        onKeyDown={commitOrCancelOnKey}
        onBlur={commit}
      />
      {error === null ? null : (
        <div
          id={errorId}
          className="inline-editor-error"
          data-testid={TESTIDS.inlineEditorError}
          role="alert"
        >
          {error}
        </div>
      )}
    </>
  );
}

export interface InlineEditorProps {
  /** The input's accessible name: what the value is, and whose. */
  label: string;
  value: string;
  error: string | null;
  onCommit: (text: string) => void;
  onCancel: () => void;
}
