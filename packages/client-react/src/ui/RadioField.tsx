import { type ChangeEvent, type ReactElement, useId } from "react";

import type { ValueOption } from "./ValueSelect.tsx";

import "./RadioField.css";

/**
 * One value out of a few, in a form row, as the design draws it: the label
 * column, then a radio for each choice in a line. Real radio inputs, so the
 * arrow keys and the group's name are the native ones. Takes only props.
 */
export function RadioField<TValue extends string>({
  label,
  options,
  value,
  onChange,
}: RadioFieldProps<TValue>): ReactElement {
  const name = useId();
  const labelId = `${name}-label`;

  function choose(event: ChangeEvent<HTMLInputElement>): void {
    onChange(event.target.value as TValue);
  }

  return (
    <div className="form-field" role="radiogroup" aria-labelledby={labelId}>
      <span id={labelId} className="form-field-label">
        {label}
      </span>
      <span className="radio-field-options">
        {options.map((option) => {
          return (
            <label key={option.value} className="radio-field-option">
              <input
                type="radio"
                className="radio-field-input"
                name={name}
                value={option.value}
                checked={option.value === value}
                onChange={choose}
              />
              {option.label}
            </label>
          );
        })}
      </span>
    </div>
  );
}

export interface RadioFieldProps<TValue extends string> {
  /** The group's accessible name: its row's label. */
  label: string;
  options: readonly ValueOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
}
