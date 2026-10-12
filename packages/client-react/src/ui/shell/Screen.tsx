import type { ReactElement } from "react";

import type { NavigationState } from "@cl/client-core";

import { menuLabel, moduleLabel } from "./labels.tsx";
import { Placeholder } from "./Placeholder.tsx";

/** The main area's content for where the person is. Every screen is a placeholder until it is built; Accounts is next. */
export function Screen({ module, menu }: ScreenProps): ReactElement {
  return (
    <Placeholder
      title={module === "buildings" ? menuLabel(menu) : moduleLabel(module)}
    />
  );
}

export interface ScreenProps {
  module: NavigationState["module"];
  menu: NavigationState["menu"];
}
