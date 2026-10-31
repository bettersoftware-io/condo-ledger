import type { ReactElement } from "react";

import type { Unit } from "@cl/domain";

import { Fieldset } from "../Fieldset.tsx";
import { formatDate } from "../format.ts";
import { Scheda } from "../Scheda.tsx";
import { SheetField } from "../SheetField.tsx";
import { UNIT_TYPE_LABELS } from "./labels.ts";

import "./UnitProfile.css";

/**
 * The Unit Profile tab: the unit's sheet, read only. Its name, where it
 * stands among the groups, its identification, its own dates, its type and
 * cadastral data, and its notes; an empty value reads `---`, dim. Takes only
 * props, so the compiler memoizes it.
 */
export function UnitProfile({
  unit,
  location,
}: UnitProfileProps): ReactElement {
  const { restriction } = unit;

  return (
    <Scheda>
      <SheetField label="Unit name" value={unit.name} />
      <SheetField label="Location" value={location} />
      <Fieldset legend="IDENTIFICATION DATA">
        <SheetField label="Code" value={unit.code} tone="mono" />
        <SheetField label="Floor" value={unit.floor} />
        <SheetField label="Interior" value={unit.interior} />
        <SheetField label="Sub-unit" value={unit.subUnit} />
      </Fieldset>
      <Fieldset legend="RESTRICTED PERIOD">
        <SheetField label="Start date" value={dateText(restriction?.from)} />
        <SheetField label="End date" value={dateText(restriction?.to)} />
      </Fieldset>
      <Fieldset legend="ADDITIONAL DATA">
        <SheetField label="Type" value={UNIT_TYPE_LABELS[unit.type]} />
        <SheetField label="Cadastral data" value={unit.cadastralData} />
      </Fieldset>
      <Fieldset legend="NOTES">
        <p className="units-notes" data-blank={isBlank(unit.notes)}>
          {isBlank(unit.notes) ? BLANK : unit.notes}
        </p>
      </Fieldset>
    </Scheda>
  );
}

export interface UnitProfileProps {
  unit: Unit;
  /** The unit's groups, root to leaf; blank at the top of the building. */
  location: string;
}

/** What an empty value reads. */
const BLANK = "---";

function isBlank(text: string | null): boolean {
  return text === null || text === "";
}

function dateText(iso: string | null | undefined): string | null {
  return iso === null || iso === undefined ? null : formatDate(iso);
}
