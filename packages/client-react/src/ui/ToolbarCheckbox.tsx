import type { ChangeEvent, ReactElement } from "react";

import { TESTIDS } from "./testids.ts";

import "./Toolbar.css";

export function ToolbarCheckbox({
  label,
  checked,
  onChange,
}: ToolbarCheckboxProps): ReactElement {
  function reportChecked(event: ChangeEvent<HTMLInputElement>): void {
    onChange(event.target.checked);
  }

  return (
    <label className="toolbar-checkbox">
      <input
        type="checkbox"
        data-testid={TESTIDS.toolbarCheckbox}
        checked={checked}
        onChange={reportChecked}
      />
      {label}
    </label>
  );
}

export interface ToolbarCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}
