import { Search } from "lucide-react";
import type { ChangeEvent, ReactElement } from "react";

import { TESTIDS } from "./testids.ts";

import "./Toolbar.css";

export function ToolbarSearch({
  value,
  placeholder,
  onChange,
}: ToolbarSearchProps): ReactElement {
  function reportText(event: ChangeEvent<HTMLInputElement>): void {
    onChange(event.target.value);
  }

  return (
    <label className="toolbar-search">
      <Search size={13} />
      <input
        type="text"
        data-testid={TESTIDS.toolbarSearch}
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={reportText}
      />
    </label>
  );
}

export interface ToolbarSearchProps {
  value: string;
  placeholder: string;
  onChange: (text: string) => void;
}
