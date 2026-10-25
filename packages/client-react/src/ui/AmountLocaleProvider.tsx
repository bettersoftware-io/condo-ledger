import type { ReactElement, ReactNode } from "react";

import { useViewModel } from "@cl/react-bindings";

import { AmountLocaleContext } from "./amountLocale.ts";

/** Hands the session's amount locale, from the view model, to everything below it. */
export function AmountLocaleProvider({
  children,
}: AmountLocaleProviderProps): ReactElement {
  const { useAmountLocale } = useViewModel();

  return (
    <AmountLocaleContext value={useAmountLocale()}>
      {children}
    </AmountLocaleContext>
  );
}

interface AmountLocaleProviderProps {
  children: ReactNode;
}
