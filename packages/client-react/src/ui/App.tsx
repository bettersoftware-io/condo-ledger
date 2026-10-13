import type { ReactElement } from "react";

import { AppRoot } from "./shell/AppRoot.tsx";

/** The whole UI: the shell, which draws the screen the person is on. */
export function App(): ReactElement {
  return <AppRoot />;
}
