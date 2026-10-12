import { createAppHarness } from "@cl/client-core/testing/appHarness.ts";

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

  return {
    app: harness.app,
    deliver: (): void => {
      if (scenario.mode !== undefined) {
        // Nothing waits: the session simulator applies the preference and resolves at once, and never rejects one.
        void harness.ports.session.setPreference({ mode: scenario.mode });
      }

      clock.tick(0);
    },
  };
}
