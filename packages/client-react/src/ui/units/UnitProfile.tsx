import type { ReactElement } from "react";

import type { Unit } from "@cl/domain";

import { Fieldset } from "../Fieldset.tsx";
import { formatDate } from "../format.ts";
import { Row } from "../Row.tsx";
import { Scheda } from "../Scheda.tsx";
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
      <Field label="Unit name" value={unit.name} />
      <Field label="Location" value={location} />
      <Fieldset legend="IDENTIFICATION DATA">
        <Field label="Code" value={unit.code} mono />
        <Field label="Floor" value={unit.floor} />
        <Field label="Interior" value={unit.interior} />
        <Field label="Sub-unit" value={unit.subUnit} />
      </Fieldset>
      <Fieldset legend="RESTRICTED PERIOD">
        <Field label="Start date" value={dateText(restriction?.from)} />
        <Field label="End date" value={dateText(restriction?.to)} />
      </Fieldset>
      <Fieldset legend="ADDITIONAL DATA">
        <Field label="Type" value={UNIT_TYPE_LABELS[unit.type]} />
        <Field label="Cadastral data" value={unit.cadastralData} />
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

interface FieldProps {
  label: string;
  /** Null or blank reads `---`. */
  value: string | null;
  mono?: boolean;
}

function Field({ label, value, mono = false }: FieldProps): ReactElement {
  if (value === null || value === "") {
    return (
      <Row label={label} tone="muted">
        {BLANK}
      </Row>
    );
  }

  return (
    <Row label={label} tone={mono ? "mono" : undefined}>
      {value}
    </Row>
  );
}

function isBlank(text: string | null): boolean {
  return text === null || text === "";
}

function dateText(iso: string | null | undefined): string | null {
  return iso === null || iso === undefined ? null : formatDate(iso);
}
