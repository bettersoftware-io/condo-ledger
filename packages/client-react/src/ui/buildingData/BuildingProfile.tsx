import type { ReactElement } from "react";

import { addressTextOf, type Building } from "@cl/domain";

import { Fieldset } from "../Fieldset.tsx";
import { formatDate } from "../format.ts";
import { Scheda } from "../Scheda.tsx";
import { SheetField } from "../SheetField.tsx";
import {
  BUILDING_TYPE_ICONS,
  BUILDING_TYPE_LABELS,
  STATUS_LABELS,
} from "./labels.ts";

import "./BuildingProfile.css";

/**
 * The Building Profile tab: the building's sheet, read only. Its name, code,
 * status (✓ Active in green), type with its icon, address, tax code and
 * construction date; OTHER: its cadastral data, the legacy system's id, and
 * when it was entered and last changed; its notes. An empty value reads
 * `---`, dim. Takes only props, so the compiler memoizes it.
 */
export function BuildingProfile({
  building,
}: BuildingProfileProps): ReactElement {
  const active = building.status === "active";
  const blankNotes = building.notes === null || building.notes === "";

  return (
    <Scheda>
      <SheetField label="Name" value={building.name} />
      <SheetField label="Building code" value={building.code} tone="mono" />
      <SheetField
        label="Status"
        value={
          active ? `✓ ${STATUS_LABELS.active}` : STATUS_LABELS[building.status]
        }
        tone={active ? "ok" : undefined}
      />
      <SheetField
        label="Type"
        value={`${BUILDING_TYPE_ICONS[building.type]} ${BUILDING_TYPE_LABELS[building.type]}`}
      />
      <SheetField
        label="Address"
        value={
          building.address === null ? null : addressTextOf(building.address)
        }
      />
      <SheetField label="Tax code" value={building.taxCode} />
      <SheetField
        label="Construction date"
        value={
          building.constructionDate === null
            ? null
            : formatDate(building.constructionDate)
        }
      />
      <Fieldset legend="OTHER">
        <SheetField label="Cadastral data" value={building.cadastralData} />
        <SheetField
          label="System ID"
          value={systemIdOf(building.id)}
          tone="mono"
        />
        <SheetField label="Created on" value={stampText(building.createdOn)} />
        <SheetField
          label="Modified on"
          value={stampText(building.modifiedOn)}
        />
      </Fieldset>
      <Fieldset legend="NOTES">
        <p className="building-profile-notes" data-blank={blankNotes}>
          {blankNotes ? "---" : building.notes}
        </p>
      </Fieldset>
    </Scheda>
  );
}

export interface BuildingProfileProps {
  building: Building;
}

/** The legacy system's number for the building: its id without the `c` the seed puts before it (`c19` is 19). */
function systemIdOf(id: string): string {
  return id.replace(/^c/u, "");
}

/** `2011-11-03 14:55:57` as `03/11/2011 14:55:57`. */
function stampText(stamp: string): string {
  return `${formatDate(stamp)} ${stamp.slice(11)}`;
}
