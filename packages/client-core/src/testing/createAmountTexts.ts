import { BehaviorSubject } from "rxjs";

import {
  type AmountLocale,
  type AmountTexts,
  amountTextsIn,
} from "#/amounts.ts";

/** A wizard's amounts in one locale that never changes: en-US unless a test names another. */
export function createAmountTexts(locale: AmountLocale = "en-US"): AmountTexts {
  return amountTextsIn(new BehaviorSubject<AmountLocale>(locale));
}
