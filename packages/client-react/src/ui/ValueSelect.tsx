import { ChevronDown } from "lucide-react";
import type { ChangeEvent, ReactElement } from "react";

import { must } from "@cl/domain/support/must.ts";

import "./ValueSelect.css";

/**
 * One value out of a few, in a form row: a native select painted as a plain
 * box with a drawn chevron, and the chosen value's words drawn over it as
 * ordinary text, as the wizards' choice select draws its account (a native
 * select's own text draws two ways from one run to the next on Linux). The
 * select stays underneath, so the keyboard, the list and the accessible
 * name are the native ones.
 */
export function ValueSelect<TValue extends string>({
  label,
  options,
  value,
  required = false,
  disabled = false,
  onChange,
}: ValueSelectProps<TValue>): ReactElement {
  function choose(event: ChangeEvent<HTMLSelectElement>): void {
    // The select offers the options alone.
    const chosen = must(
      options.find((option) => {
        return option.value === event.target.value;
      }),
      `the option ${event.target.value}`,
    );

    onChange(chosen.value);
  }

  const shown = must(
    options.find((option) => {
      return option.value === value;
    }),
    `the option ${value}`,
  );

  return (
    <span className="value-select">
      <select
        className="value-select-control"
        aria-label={label}
        aria-required={required}
        value={value}
        disabled={disabled}
        onChange={choose}
      >
        {options.map((option) => {
          return (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          );
        })}
      </select>
      <span className="value-select-text" aria-hidden="true">
        {shown.label}
      </span>
      <ChevronDown
        className="value-select-chevron"
        size={12}
        aria-hidden="true"
      />
    </span>
  );
}

/** A value and its words. */
export interface ValueOption<TValue extends string> {
  value: TValue;
  label: string;
}

export interface ValueSelectProps<TValue extends string> {
  /** The select's accessible name: its row's label. */
  label: string;
  options: readonly ValueOption<TValue>[];
  value: TValue;
  /** Announced as required: set where the row it sits in says `required`. */
  required?: boolean;
  /** The value is fixed: shown, dimmed, and cannot change. */
  disabled?: boolean;
  onChange: (value: TValue) => void;
}
