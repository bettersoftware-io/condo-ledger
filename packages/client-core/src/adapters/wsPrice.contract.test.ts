import { Subject } from "rxjs";

import type { Price } from "@cl/domain";
import { describePricePortContract } from "@cl/domain/ports/__contracts__/PricePortContract.ts";
import { encodePrice } from "@cl/shared";

import { createWsPricePort } from "./wsPrice.ts";

describePricePortContract("WebSocket price adapter", () => {
  const messages$ = new Subject<unknown>();

  return {
    port: createWsPricePort({
      messages: () => {
        return messages$;
      },
    }),
    produce: (price: Price): void => {
      messages$.next(encodePrice(price));
    },
    teardown: (): void => {
      messages$.complete();
    },
  };
});
