import type { PeriodDates, Rejected } from "@cl/domain";

import { formatDate } from "../format.ts";
import { reasonText } from "../journal/wizards/reasons.ts";

/** What a refusal's words name beyond its detail: the draft it judged, the period, and the contacts by id. */
export interface UnitsReasonSubject {
  /** The group's code as typed: `group-taken` names it. */
  code?: string;
  /** The group's name as typed. */
  name?: string;
  /** The period a unit's or a resident's dates must lie within. */
  period?: PeriodDates;
  /** A contact's name by its id: `already-resident` carries the id. */
  contactName?: (contactId: string) => string;
}

/** The Units screen's reasons with nothing to fill in. */
const FIXED: Readonly<Record<string, string>> = {
  "blank-code": "Enter a code",
  "blank-name": "Enter a name",
  "bad-dates": "The end date is before the start date",
  "group-not-empty": "Move or delete its units and groups first",
  "no-contact": "Choose a contact",
  "not-a-date": "Enter a date as day/month/year",
};

/**
 * A refusal of the group, unit and owner dialogs, or of a delete on the Units
 * screen, as the person reads it. A taken group is named by the code and the
 * name typed, the domain's detail standing in for either when they are not
 * given; the rest by their detail. The wizards' common reasons
 * (`not-an-amount`, `saving`) in their words, and a reason no one words as
 * it is.
 */
export function unitsReasonText(
  refusal: Rejected,
  subject: UnitsReasonSubject = {},
): string {
  const detail = refusal.detail ?? "";

  switch (refusal.reason) {
    case "group-taken":
      return `A group with code ${subject.code ?? detail} or name ${subject.name ?? detail} is already in this group`;
    case "unit-code-taken":
      return `Another unit of this period has the code ${detail}`;
    case "outside-period":
      return subject.period === undefined
        ? "The dates must lie within the period"
        : `The dates must lie within the period (${formatDate(subject.period.start)} - ${formatDate(subject.period.end)})`;
    case "already-resident":
      return `${subject.contactName?.(detail) ?? detail} already lives in this unit`;
    case "named-in-journal":
      return `${detail} is named in the journal: delete those entries first`;
    case "has-installments":
      return `${detail} has installments: delete those first`;
    default:
      return reasonText(refusal.reason, FIXED);
  }
}
