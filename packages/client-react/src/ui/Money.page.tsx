import { render } from "@testing-library/react";

import { type AmountLocale, DEFAULT_AMOUNT_LOCALE } from "@cl/client-core";

import { AmountLocaleContext } from "./amountLocale.ts";
import { Money, type MoneyProps } from "./Money.tsx";
import { TESTIDS } from "./testids.ts";

/** What a test can ask of a money cell. */
export interface MoneyPage {
  text: () => string;
  tone: () => string;
  variant: () => string;
  emphasis: () => string;
}

/** Mounts a money cell under the amount locale the session would hand down. */
export function mountMoney(
  props: MoneyProps,
  locale: AmountLocale = DEFAULT_AMOUNT_LOCALE,
): MoneyPage {
  const rendered = render(
    <AmountLocaleContext value={locale}>
      <Money {...props} />
    </AmountLocaleContext>,
  );

  function cell(): HTMLElement {
    return rendered.getByTestId(TESTIDS.money);
  }

  return {
    text: (): string => {
      return cell().textContent ?? "";
    },
    tone: (): string => {
      return cell().dataset.tone ?? "";
    },
    variant: (): string => {
      return cell().dataset.variant ?? "";
    },
    emphasis: (): string => {
      return cell().dataset.emphasis ?? "";
    },
  };
}
