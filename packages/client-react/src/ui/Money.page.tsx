import { render } from "@testing-library/react";

import { Money, type MoneyProps } from "./Money.tsx";
import { TESTIDS } from "./testids.ts";

/** What a test can ask of a money cell. */
export interface MoneyPage {
  text: () => string;
  tone: () => string;
  variant: () => string;
  emphasis: () => string;
}

export function mountMoney(props: MoneyProps): MoneyPage {
  const rendered = render(<Money {...props} />);

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
