import type { ReactElement } from "react";

import { formatTenThousandths } from "@cl/client-core";

import { useLocale } from "../amountLocale.ts";

import "./Coefficient.css";

/** A coefficient or a table's total: four decimals in the session's locale, tabular and right-aligned, plain (grey when zero), as the prototype draws a table's numbers. */
export function Coefficient({
  value,
  emphasis = false,
}: CoefficientProps): ReactElement {
  const locale = useLocale();

  return (
    <span
      className="coefficient"
      data-zero={value === 0}
      data-emphasis={emphasis}
    >
      {formatTenThousandths(value, locale)}
    </span>
  );
}

export interface CoefficientProps {
  /** In ten-thousandths. */
  value: number;
  /** A group's sum: bold. */
  emphasis?: boolean;
}
