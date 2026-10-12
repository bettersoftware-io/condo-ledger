import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";

import { DEFAULT_PREFERENCES, type Preferences } from "#/entities/session.ts";

import {
  createSessionSimulator,
  DESIGN_FIRM,
  DESIGN_PRINCIPAL,
} from "./sessionSimulator.ts";

describe("session simulator", () => {
  it("starts on the default preferences when none are given", async () => {
    const port = createSessionSimulator({
      principal: DESIGN_PRINCIPAL,
      firm: DESIGN_FIRM,
    });

    expect(await firstValueFrom(port.preferences())).toEqual(
      DEFAULT_PREFERENCES,
    );
  });

  it("keeps the preferences it was given", async () => {
    const given: Preferences = { mode: "dark", theme: "sage", language: "it" };
    const port = createSessionSimulator({
      principal: DESIGN_PRINCIPAL,
      firm: DESIGN_FIRM,
      preferences: given,
    });

    expect(await firstValueFrom(port.preferences())).toEqual(given);
  });

  it("answers the principal and the firm it was given", async () => {
    const port = createSessionSimulator({
      principal: DESIGN_PRINCIPAL,
      firm: DESIGN_FIRM,
    });

    expect(await firstValueFrom(port.principal())).toEqual(DESIGN_PRINCIPAL);
    expect(await firstValueFrom(port.firm())).toEqual(DESIGN_FIRM);
  });

  it("changes only the preference patched", async () => {
    const port = createSessionSimulator({
      principal: DESIGN_PRINCIPAL,
      firm: DESIGN_FIRM,
    });

    await port.setPreference({ language: "fr" });

    expect(await firstValueFrom(port.preferences())).toEqual({
      ...DEFAULT_PREFERENCES,
      language: "fr",
    });
  });
});
