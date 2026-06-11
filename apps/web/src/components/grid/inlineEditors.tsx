import { useState } from "react";
import type { Money } from "@cl/domain";
import { formatEUR } from "@cl/domain";
import { parseItMoney } from "../forms/parse";
import styles from "./TreeTable.module.css";

/** Inline numeric editor: double-click to edit, Enter/blur commits, Esc cancels. */
export function InlineNumber({
  value, onCommit, decimals = 4,
}: { value: number; onCommit: (next: number) => void; decimals?: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  if (!editing) {
    return (
      <span onDoubleClick={() => { setDraft(String(value)); setEditing(true); }}>
        {value.toLocaleString("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      </span>
    );
  }
  const commit = () => {
    const n = Number(draft.replace(",", "."));
    if (!Number.isNaN(n)) onCommit(n);
    setEditing(false);
  };
  return (
    <input
      autoFocus className={styles.editInput} value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
    />
  );
}

/** Inline money editor: double-click to edit; Enter/blur commits integer cents; Esc cancels. */
export function InlineMoney({ value, onCommit }: { value: Money; onCommit: (cents: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(formatEUR(value));
  if (!editing) {
    return (
      <span onDoubleClick={() => { setDraft(formatEUR(value)); setEditing(true); }}>
        {formatEUR(value)}
      </span>
    );
  }
  const commit = () => {
    const cents = parseItMoney(draft);
    if (cents !== null) onCommit(cents);
    setEditing(false);
  };
  return (
    <input
      autoFocus className={styles.editInput} value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
    />
  );
}
