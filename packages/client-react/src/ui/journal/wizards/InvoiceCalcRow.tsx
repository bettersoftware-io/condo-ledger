import {
  type ChangeEvent,
  type ReactElement,
  type ReactNode,
  useId,
} from "react";

import type { Cents } from "@cl/domain";

import { Money } from "#/ui/Money.tsx";
import { TESTIDS } from "#/ui/testids.ts";

import "./InvoiceWizard.css";

/**
 * One computed row of the invoice's step 2: its label, the rate the person
 * types (a percentage) or another control, and the amount the core computed,
 * blank while it cannot be. A strong row is a total, on the zebra. A rate
 * takes the row's label as its name.
 */
export function InvoiceCalcRow({
  label,
  rate,
  control,
  amount,
  strong = false,
}: InvoiceCalcRowProps): ReactElement {
  const rateId = useId();

  return (
    <div
      className="invoice-calc-row"
      data-testid={TESTIDS.invoiceCalcRow}
      data-strong={strong}
      data-control={controlKind(rate, control)}
    >
      {rate === undefined ? (
        <>
          <span className="invoice-calc-label">{label}</span>
          {control}
        </>
      ) : (
        <>
          <label className="invoice-calc-label" htmlFor={rateId}>
            {label}
          </label>
          <RateBox id={rateId} rate={rate} />
        </>
      )}
      <span className="invoice-calc-amount">
        <Money cents={amount} variant="plain" emphasis={strong} />
      </span>
    </div>
  );
}

export interface InvoiceCalcRowProps {
  label: string;
  /** The rate the row applies, typed by the person; left out for a row with none. */
  rate?: RateField;
  /** Another control between the label and the amount: the withholding code's select. */
  control?: ReactNode;
  /** Null while it cannot be computed. */
  amount: Cents | null;
  /** A total: bold, on the zebra. */
  strong?: boolean;
}

/** A rate as typed, a percentage: `4` is 4%. */
interface RateField {
  text: string;
  onChange: (text: string) => void;
}

/** The rate's box, a `%` drawn after the number. */
function RateBox({ id, rate }: RateBoxProps): ReactElement {
  function edit(event: ChangeEvent<HTMLInputElement>): void {
    rate.onChange(event.target.value);
  }

  return (
    <span className="invoice-calc-rate">
      <input
        id={id}
        className="wizard-input"
        inputMode="decimal"
        value={rate.text}
        onChange={edit}
      />
      <span aria-hidden="true">%</span>
    </span>
  );
}

interface RateBoxProps {
  id: string;
  rate: RateField;
}

/** What sits between the label and the amount, for the row's columns. */
function controlKind(
  rate: RateField | undefined,
  control: ReactNode,
): "rate" | "select" | "none" {
  if (rate !== undefined) {
    return "rate";
  }

  return control === undefined ? "none" : "select";
}
