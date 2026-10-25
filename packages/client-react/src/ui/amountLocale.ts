import { createContext, useContext } from "react";

import { type AmountLocale, DEFAULT_AMOUNT_LOCALE } from "@cl/client-core";

/**
 * The locale amounts are shown and typed in, handed down the tree by
 * AmountLocaleProvider so a money cell reads it without a subscription of its
 * own. A part drawn without the provider (a test, a picture of one
 * component) shows the default language's.
 */
export const AmountLocaleContext = createContext<AmountLocale>(
  DEFAULT_AMOUNT_LOCALE,
);

/** The locale the provider above hands down: what `formatCents` and `parseAmount` are given. */
export function useLocale(): AmountLocale {
  return useContext(AmountLocaleContext);
}
