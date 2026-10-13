import { act, render } from "@testing-library/react";

import type { NavigationState } from "@cl/client-core";
import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import type { LegacySeed } from "@cl/domain";
import { createViewModel, ViewModelProvider } from "@cl/react-bindings";

import { TESTIDS } from "../testids.ts";
import { Breadcrumb } from "./Breadcrumb.tsx";

/** What a test can do with, and ask of, the breadcrumb. */
export interface BreadcrumbPage {
  /** The crumbs, joined as the bar shows them. */
  trail: () => string;
  /** The crumb drawn as the current place. */
  current: () => string;
  selectModule: (module: NavigationState["module"]) => Promise<void>;
  selectMenu: (menu: NavigationState["menu"]) => Promise<void>;
}

/** Mounts the breadcrumb over the given seed; the page moves the app-wide navigation as a module tab or a menu item would. */
export function mountBreadcrumb(seed: LegacySeed): BreadcrumbPage {
  const { app } = createAppHarness(seed);
  const rendered = render(
    <ViewModelProvider viewModel={createViewModel(app)}>
      <Breadcrumb />
    </ViewModelProvider>,
  );

  function crumbs(): HTMLElement[] {
    return Array.from(
      rendered
        .getByTestId(TESTIDS.breadcrumb)
        .querySelectorAll<HTMLElement>(".breadcrumb-item"),
    );
  }

  return {
    trail: (): string => {
      return crumbs()
        .map((crumb) => {
          return crumb.textContent ?? "";
        })
        .join(" › ");
    },
    current: (): string => {
      return (
        crumbs().find((crumb) => {
          return crumb.getAttribute("aria-current") === "page";
        })?.textContent ?? ""
      );
    },
    selectModule: async (module: NavigationState["module"]): Promise<void> => {
      await act(async () => {
        app.navigation.intents.selectModule(module);
      });
    },
    selectMenu: async (menu: NavigationState["menu"]): Promise<void> => {
      await act(async () => {
        app.navigation.intents.selectMenu(menu);
      });
    },
  };
}
