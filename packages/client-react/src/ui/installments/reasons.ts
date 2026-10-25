import { reasonText } from "../journal/wizards/reasons.ts";

/** The schedule's reasons, from the domain's write rules and the presenter, as the person reads them. */
const SCHEDULE_REASONS: Readonly<Record<string, string>> = {
  "installment-locked": "This installment is locked: unlock it first.",
  "installment-paid":
    "A collection has paid part of this installment: delete that collection first.",
  "item-paid":
    "A collection has paid this amount: delete that collection first.",
  "negative-amount": "An amount cannot be negative.",
  "no-books": "No period is selected.",
  "unknown-item": "This amount is no longer in the period.",
};

/** A reason in the schedule's words, then the wizards' common ones (`not-an-amount`); a reason no one words is shown as it is. */
export function scheduleReasonText(reason: string): string {
  return reasonText(reason, SCHEDULE_REASONS);
}
