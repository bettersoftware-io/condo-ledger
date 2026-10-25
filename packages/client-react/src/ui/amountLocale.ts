import { createContext, useContext } from "react";

import { type AmountLocale, DEFAULT_AMOUNT_LOCALE } from "@cl/client-core";

/**
 * The locale amounts are shown and typed in, handed down the tree by
 * AmountLocaleProvider so a money cell reads it without a subscription of its
 * own. Its default, en-US (the default language's), stands in only where no
 * provider is present: a unit test that renders a component alone. The app
 * and the visual host always put the provider above what they draw.
 */
export const AmountLocaleContext = createContext<AmountLocale>(
  DEFAULT_AMOUNT_LOCALE,
);

/** The locale the provider above hands down: what `formatCents` and `parseAmount` are given. */
export function useLocale(): AmountLocale {
  return useContext(AmountLocaleContext);
}
