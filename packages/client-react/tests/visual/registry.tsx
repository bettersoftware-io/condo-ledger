import type { ReactElement, ReactNode } from "react";

import type { SettlementRow } from "@cl/client-core";
import { useViewModel } from "@cl/react-bindings";

import { CollectionWizard } from "#/ui/journal/wizards/CollectionWizard.tsx";
import { SettlementTable } from "#/ui/journal/wizards/SettlementTable.tsx";

import type { Scenario } from "./scenarios.ts";

// What a scenario's `mount` names: the parts of the UI that are pictured on
// their own. This file is the project's. A new component gets an entry here,
// and its states get scenarios in `scenarios.ts`.
//
// An entry turns a scenario into an element. A leaf takes its props from the
// scenario. A part that reads the view model is given its state by the
// seeding, through the harness, as it is for the whole app.

/** Turns a scenario into the element it pictures. */
type Entry = (scenario: Scenario) => ReactElement;

const registry: Record<string, Entry> = {
  // The wizard reads its machine, which the seeding holds on the scenario's
  // step. Saving and cancelling close it on the Journal; alone, it stays.
  "collection-wizard": (): ReactElement => {
    return (
      <CollectionWizard
        editing={null}
        onSaved={ignoreClose}
        onCancel={ignoreClose}
      />
    );
  },
  "settlement-table": (scenario: Scenario): ReactElement => {
    return <SettlementTable rows={settlementOf(scenario)} />;
  },
};

interface SurroundProps {
  children: ReactNode;
}

/**
 * What the app puts around everything it draws, without its layout: the
 * theme and the mode `ui/shell/AppRoot.tsx` sets on its root, where the
 * tokens read them. The mode is the session's preference, which the seeding
 * sets from the scenario. The page around a part keeps the body's colours,
 * the default theme's light ones.
 */
function Surround({ children }: SurroundProps): ReactElement {
  const { useSession } = useViewModel();
  const { preferences } = useSession();

  return (
    <div data-theme={preferences.theme} data-mode={preferences.mode}>
      {children}
    </div>
  );
}

interface MountProps {
  scenario: Scenario;
}

/** The entry a scenario's `mount` names, in the app's surround. */
export function Mount({ scenario }: MountProps): ReactElement {
  const key = scenario.mount ?? "";
  const entry: Entry | undefined = registry[key];

  if (entry === undefined) {
    throw new Error(
      `No entry "${key}" in registry.tsx. Its entries: ${Object.keys(registry).join(", ")}`,
    );
  }

  return <Surround>{entry(scenario)}</Surround>;
}

function settlementOf(scenario: Scenario): SettlementRow[] {
  if (scenario.settlement === undefined) {
    throw new Error(
      'A "settlement-table" mount shows the scenario\'s `settlement`, and this one has none.',
    );
  }

  return scenario.settlement;
}

/** A picture is never clicked. */
function ignoreClose(): void {
  // Nothing to do.
}
