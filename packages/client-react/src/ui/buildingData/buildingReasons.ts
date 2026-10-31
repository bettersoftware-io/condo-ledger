import type { Rejected } from "@cl/domain";

import { reasonText } from "../journal/wizards/reasons.ts";

/** The Building Data screen's reasons with nothing to fill in. */
const FIXED: Readonly<Record<string, string>> = {
  "blank-name": "Enter a name",
  "blank-street": "Enter the street and number",
  "bad-dates": "The end date is before the start date",
  "not-a-date": "Enter a date as day/month/year",
};

/**
 * A refusal of the Edit Building, Edit Management / Period or Address
 * dialog as the person reads it. A taken name or code, and the unit or
 * resident whose own dates the period's would cut, are named by the
 * refusal's detail; the wizards' common reasons (`saving`) in their words.
 */
export function buildingReasonText(refusal: Rejected): string {
  const detail = refusal.detail ?? "";

  switch (refusal.reason) {
    case "building-name-taken":
      return `Another building is named ${detail}`;
    case "building-code-taken":
      return `Another building has the code ${detail}`;
    case "period-name-taken":
      return `This building has another period named ${detail}`;
    case "period-excludes":
      return `${detail} has dates outside these: change them first`;
    default:
      return reasonText(refusal.reason, FIXED);
  }
}
