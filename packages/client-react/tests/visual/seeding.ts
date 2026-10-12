import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";
import type { Result } from "@cl/domain";

import type { HostClock, Seeded } from "./host/seeded.ts";
import type { Scenario } from "./scenarios.ts";

// How a scenario's data becomes app state. This file is the project's: when a
// feature adds a field to `Scenario`, the lines that deliver it go here. The
// host (`host/`) belongs to the add-on and never needs an edit for a feature:
// it owns the clock, calls `deliver` once the UI has subscribed, and says when
// the picture may be taken.
//
// Two places to put state, and a rule for choosing:
//
// - `app`: what must be true before the first render. A port that answers
//   from memory is given its data when the harness is built; a machine is
//   wrapped so that each one built already holds the scenario's value, set
//   through its own intent.
// - `deliver`: what arrives after the UI is on screen, in order. A wait is
//   `clock.tick(...)`, never a real one.

/** The application and the deliveries of one scenario. Called once, before the first render. */
export function seedScenario(scenario: Scenario, clock: HostClock): Seeded {
  const harness = createAppHarness();

  // The mode is a preference the session port answers from memory, so it goes
  // in before the first render, as the person would set it.
  if (scenario.mode !== undefined) {
    // Nothing may wait: the host's contract is synchronous. The simulator
    // applies the preference at once; a refusal or a failure is rethrown
    // where the visual run sees it, as an uncaught error on the page.
    void harness.ports.session
      .setPreference({ mode: scenario.mode })
      .then(failOnRefusal)
      .catch(reportOnThePage);
  }

  return {
    app: harness.app,
    deliver: (): void => {
      clock.tick(0);
    },
  };
}

function failOnRefusal(result: Result): void {
  if (!result.ok) {
    throw new Error(`the scenario's mode was refused: ${result.reason}`);
  }
}

/** The host's fake clock leaves microtasks alone, so this throw is never held back. */
function reportOnThePage(error: unknown): void {
  queueMicrotask(() => {
    throw error;
  });
}
