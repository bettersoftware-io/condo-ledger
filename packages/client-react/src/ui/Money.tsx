import type { ReactElement } from "react";

import type { Cents } from "@cl/domain";

import { formatCents } from "./format.ts";
import { TESTIDS } from "./testids.ts";

import "./Money.css";

/** A money cell: right-aligned, tabular digits, coloured by sign. Formatting only; the number is the core's. */
export function Money({
  cents,
  variant = "colored",
  emphasis = false,
}: MoneyProps): ReactElement {
  return (
    <span
      className="money"
      data-testid={TESTIDS.money}
      data-tone={toneOf(cents)}
      data-variant={variant}
      data-emphasis={emphasis}
    >
      {cents === null ? "" : formatCents(cents)}
    </span>
  );
}

export interface MoneyProps {
  cents: Cents | null;
  /** `plain` is the Journal and Ledger's Debit/Credit: text colour, grey when zero. */
  variant?: "colored" | "plain";
  /** Aggregates: group rows and totals. */
  emphasis?: boolean;
}

function toneOf(cents: Cents | null): "blank" | "neg" | "zero" | "pos" {
  if (cents === null) {
    return "blank";
  }

  if (cents < 0) {
    return "neg";
  }

  return cents === 0 ? "zero" : "pos";
}
