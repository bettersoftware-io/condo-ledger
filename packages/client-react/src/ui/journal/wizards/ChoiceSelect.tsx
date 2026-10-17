import { ChevronDown } from "lucide-react";
import type { ChangeEvent, ReactElement } from "react";

import type { WizardChoice } from "@cl/client-core";

import { TESTIDS } from "#/ui/testids.ts";

/**
 * A line's account cell: a native select over the wizard's choices, one
 * `<optgroup>` per group in the order the choices come, and an empty first
 * option while none is chosen.
 *
 * The select paints as a plain box (`appearance: none`) with a drawn chevron
 * over its right edge, and the chosen account's name is drawn over it as
 * ordinary text: Chromium on Linux painted a select's own text one of two
 * ways from one run to the next, while the same text in a plain element was
 * identical in every run. The select stays underneath, so the keyboard, the
 * list of options and the accessible name are the native ones.
 */
export function ChoiceSelect({
  label,
  choices,
  value,
  onChoose,
  disabled = false,
  placeholder = NO_ACCOUNT,
}: ChoiceSelectProps): ReactElement {
  function choose(event: ChangeEvent<HTMLSelectElement>): void {
    onChoose(event.target.value === "" ? null : event.target.value);
  }

  const chosen = choices.find((choice) => {
    return choice.key === value;
  });

  return (
    <span className="wizard-select-box">
      <select
        className="wizard-input wizard-select"
        aria-label={label}
        value={value ?? ""}
        onChange={choose}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {groupsOf(choices).map((group) => {
          return (
            <optgroup key={group.label} label={group.label}>
              {group.choices.map((choice) => {
                return (
                  <option key={choice.key} value={choice.key}>
                    {choice.label}
                  </option>
                );
              })}
            </optgroup>
          );
        })}
      </select>
      <span
        className="wizard-select-text"
        aria-hidden="true"
        data-testid={TESTIDS.wizardSelectText}
      >
        {chosen === undefined ? placeholder : chosen.label}
      </span>
      <ChevronDown
        className="wizard-select-chevron"
        size={12}
        aria-hidden="true"
      />
    </span>
  );
}

/** The empty first option, and what the cell shows while no account is chosen. */
const NO_ACCOUNT = "Choose an account…";

export interface ChoiceSelectProps {
  /** The cell's accessible name: which line, which column. */
  label: string;
  choices: WizardChoice[];
  value: string | null;
  onChoose: (key: string | null) => void;
  /** The choice is fixed: the select is shown but cannot be changed. */
  disabled?: boolean;
  /** What the empty first option and the cell say while nothing is chosen. */
  placeholder?: string;
}

/** Choices of one group, kept together. */
interface ChoiceGroup {
  label: string;
  choices: WizardChoice[];
}

/** The choices by group, each group where its first choice comes. */
function groupsOf(choices: WizardChoice[]): ChoiceGroup[] {
  const groups: ChoiceGroup[] = [];

  for (const choice of choices) {
    const group = groups.find((candidate) => {
      return candidate.label === choice.group;
    });

    if (group === undefined) {
      groups.push({ label: choice.group, choices: [choice] });
    } else {
      group.choices.push(choice);
    }
  }

  return groups;
}
