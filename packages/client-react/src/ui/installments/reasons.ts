import { reasonText } from "../journal/wizards/reasons.ts";

/** The schedule's reasons, from the domain's write rules, the wizard, the dialog and the presenter, as the person reads them. */
const SCHEDULE_REASONS: Readonly<Record<string, string>> = {
  "installment-locked": "This installment is locked: unlock it first.",
  "installment-paid":
    "A collection has paid part of this installment: delete that collection first.",
  "item-paid":
    "A collection has paid this amount: delete that collection first.",
  "negative-amount": "An amount cannot be negative.",
  "no-books": "No period is selected.",
  "unknown-item": "This amount is no longer in the period.",
  "no-budget-allocation":
    "This period has no budget allocation entry to share out.",
  "count-out-of-range": "Enter a number of installments from 1 to 12.",
  "months-out-of-range":
    "Enter a number of months from 1 to 5 between installments.",
  "invalid-due-date": "Enter a due date as day/month/year.",
  "not-a-percentage":
    "Enter each percentage as a number with at most two decimals.",
  "rows-not-count":
    "The installments no longer match their number: go back and enter it again.",
  "no-installments": "Create at least one installment.",
  "blank-name": "An installment needs a name.",
  "name-taken": "Another installment of this period already has this name.",
  "negative-percentage": "A percentage cannot be negative.",
  "percentages-not-100": "The percentages must add up to 100.",
};

/** A reason in the schedule's words, then the wizards' common ones (`not-an-amount`, `saving`); a reason no one words is shown as it is. */
export function scheduleReasonText(reason: string): string {
  return reasonText(reason, SCHEDULE_REASONS);
}
