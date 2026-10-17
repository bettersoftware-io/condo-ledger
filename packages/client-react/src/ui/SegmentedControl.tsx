import { type ReactElement, useId } from "react";

import { TESTIDS } from "./testids.ts";

import "./SegmentedControl.css";

/**
 * A few exclusive choices drawn as pills in a row, as a group of radios under
 * a name: the arrow keys move the choice, as they do in any radio group. The
 * chosen pill is on `--sel` with `--acc` text, as the toolbar's chips are.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>): ReactElement {
  const name = useId();

  return (
    <div
      className="segmented-control"
      role="radiogroup"
      aria-label={label}
      data-testid={TESTIDS.segmentedControl}
    >
      {options.map((option) => {
        function choose(): void {
          onChange(option.value);
        }

        return (
          <label
            key={option.value}
            className="segment"
            data-testid={TESTIDS.segment}
            data-selected={option.value === value}
          >
            <input
              type="radio"
              className="segment-radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={choose}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** The group's accessible name. */
  label: string;
}
