import { type ReactElement, type ReactNode, useId } from "react";

import { TESTIDS } from "./testids.ts";

import "./SelectableList.css";

/**
 * A list to choose one item from, as a group of radios under its label: the
 * rows are the radios' labels, the chosen one drawn selected. The arrow keys
 * move the choice, as they do in any radio group.
 */
export function SelectableList({
  label,
  items,
  selectedKey,
  onSelect,
}: SelectableListProps): ReactElement {
  const name = useId();

  return (
    <fieldset className="selectable-list" data-testid={TESTIDS.selectableList}>
      <legend className="selectable-list-legend">{label}</legend>
      <div className="selectable-list-rows">
        {items.map((item) => {
          const selected = item.key === selectedKey;

          function select(): void {
            onSelect(item.key);
          }

          return (
            <label
              key={item.key}
              className="selectable-list-item"
              data-testid={TESTIDS.selectableItem}
              data-selected={selected}
            >
              <input
                type="radio"
                className="selectable-list-radio"
                name={name}
                value={item.key}
                checked={selected}
                onChange={select}
              />
              {item.icon === undefined ? null : (
                <span className="selectable-list-icon" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              <span className="selectable-list-label">{item.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export interface SelectableItem {
  key: string;
  label: string;
  /** Drawn before the label, out of the item's accessible name. */
  icon?: ReactNode;
}

export interface SelectableListProps {
  /** The section label above the rows, and the group's name. */
  label: string;
  items: SelectableItem[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}
