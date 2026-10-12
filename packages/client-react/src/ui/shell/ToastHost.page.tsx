import { act, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import { createSmallSeed } from "@cl/domain/testing/createSmallBooks.ts";
import { createViewModel, ViewModelProvider } from "@cl/react-bindings";

import { TESTIDS } from "../testids.ts";
import { ToastHost } from "./ToastHost.tsx";

/** What a test can do with, and ask of, the toasts. */
export interface ToastHostPage {
  /** Posts a notice the way a control the app does not wire yet does. */
  stub: (label: string) => Promise<void>;
  toasts: () => string[];
  dismiss: (index: number) => Promise<void>;
}

/** Mounts the toasts over the real application on the small books. */
export function mountToastHost(): ToastHostPage {
  const user = userEvent.setup();
  const { app } = createAppHarness(createSmallSeed());
  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(app)}>
      <ToastHost />
    </ViewModelProvider>,
  );

  return {
    stub: async (label: string): Promise<void> => {
      await act(async () => {
        app.notices.stub(label);
      });
    },
    toasts: (): string[] => {
      return rendered.queryAllByTestId(TESTIDS.toast).map((toast) => {
        return toast.querySelector(".toast-text")?.textContent ?? "";
      });
    },
    dismiss: async (index: number): Promise<void> => {
      const toast = rendered.getAllByTestId(TESTIDS.toast)[index];

      if (toast === undefined) {
        throw new Error(`No toast ${index}`);
      }

      await user.click(within(toast).getByTestId(TESTIDS.toastDismiss));
    },
  };
}
