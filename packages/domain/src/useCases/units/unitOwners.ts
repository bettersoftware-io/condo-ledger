import type { OwnerParty } from "#/entities/party.ts";
import type { Unit } from "#/entities/unit.ts";

import { residentsOf, restrictionTextOf } from "../allocation/layout.ts";
import {
  type AllocationInput,
  compoundCoefficientOf,
  priorityOf,
} from "../allocation/share.ts";
import { daysOf, type PeriodDates } from "../schedule.ts";

/** One row of the Unit Owners tab: the period's head, a role's sub-head, or a resident. */
export interface OwnersRow {
  key: string;
  kind: "period" | "role" | "resident";
  label: string;
  /** The owner relationship scenario, on the head row only. */
  scenario: string;
  /** Whether the resident leaves before the end: an end date of their own. */
  out: boolean;
  restriction: string;
  /** "{days}/{upper}" on the head row and on a resident with dates of their own; blank otherwise. */
  days: string;
  /** The resident's co-ownership percentage, in ten-thousandths of a percent; null when empty. */
  share: number | null;
  /** The resident's co-ownership factor times their residency factor. */
  coefficient: number | null;
  residentId: string | null;
  children: OwnersRow[];
}

/**
 * The unit's owners over its period: the head row "Full period", a sub-head
 * per role present in priority order, the residents under theirs. Days count
 * over the unit's own dates, else the period's: a unit's dates prorate nobody.
 */
export function unitOwnersOf(unit: Unit, input: AllocationInput): OwnersRow {
  const span: PeriodDates = {
    start: unit.restriction?.from ?? input.period.start,
    end: unit.restriction?.to ?? input.period.end,
  };
  const residents = residentsOf(input.residents, unit.id);
  const roles = [
    ...new Set(
      residents.map((resident) => {
        return resident.role;
      }),
    ),
  ].sort((a, b) => {
    return priorityOf(a) - priorityOf(b);
  });

  return {
    ...BLANK,
    key: `period:${unit.id}`,
    kind: "period",
    label: "Full period",
    scenario: "Standard (owner/tenant)",
    restriction: restrictionTextOf(unit.restriction),
    days: daysOf({ from: span.start, to: span.end }, span),
    children: roles.map((role) => {
      return {
        ...BLANK,
        key: `role:${role}`,
        kind: "role",
        label: ROLE_HEADS.get(role) ?? role,
        children: residents
          .filter((resident) => {
            return resident.role === role;
          })
          .map((resident) => {
            return residentRow(resident, span, input);
          }),
      };
    }),
  };
}

const ROLE_HEADS = new Map([
  ["PR", "Owners"],
  ["CO", "Tenants"],
  ["SC", "Subtenants"],
]);

/** A row's fields before it says otherwise. */
const BLANK: OwnersRow = {
  key: "",
  kind: "role",
  label: "",
  scenario: "",
  out: false,
  restriction: "",
  days: "",
  share: null,
  coefficient: null,
  residentId: null,
  children: [],
};

function residentRow(
  resident: OwnerParty,
  span: PeriodDates,
  input: AllocationInput,
): OwnersRow {
  const own = resident.ownRestriction;

  return {
    ...BLANK,
    key: `resident:${resident.id}`,
    kind: "resident",
    label: resident.name,
    out: own?.to != null,
    restriction: restrictionTextOf(own),
    days: daysOf(own, span),
    share: resident.share,
    coefficient: compoundCoefficientOf(input, resident),
    residentId: resident.id,
  };
}
