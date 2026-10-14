import { ChevronDown } from "lucide-react";
import type { ChangeEvent, ReactElement } from "react";

import type { WizardChoice } from "@cl/client-core";

/**
 * A line's account cell: a native select over the wizard's choices, one
 * `<optgroup>` per group in the order the choices come, and an empty first
 * option while none is chosen.
 *
 * The select paints as a plain box (`appearance: none`) with a drawn chevron
 * over its right edge: in Chromium on Linux a native select's text, painted
 * through the platform theme, differed from one screenshot to the next.
 */
export function ChoiceSelect({
  label,
  choices,
  value,
  onChoose,
}: ChoiceSelectProps): ReactElement {
  function choose(event: ChangeEvent<HTMLSelectElement>): void {
    onChoose(event.target.value === "" ? null : event.target.value);
  }

  return (
    <span className="wizard-select-box">
      <select
        className="wizard-input wizard-select"
        aria-label={label}
        value={value ?? ""}
        onChange={choose}
      >
        <option value="">Choose an account…</option>
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
      <ChevronDown
        className="wizard-select-chevron"
        size={12}
        aria-hidden="true"
      />
    </span>
  );
}

export interface ChoiceSelectProps {
  /** The cell's accessible name: which line, which column. */
  label: string;
  choices: WizardChoice[];
  value: string | null;
  onChoose: (key: string | null) => void;
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
