import { describe, expect, it } from "vitest";

import {
  createSessionSimulator,
  DEFAULT_PREFERENCES,
  DESIGN_FIRM,
  DESIGN_PRINCIPAL,
  type Firm,
  type Preferences,
  type Principal,
} from "@cl/domain";

import {
  createSessionPresenter,
  type SessionPresenter,
} from "./sessionPresenter.ts";

describe("the session presenter", () => {
  it("answers the principal, firm and preferences", () => {
    const { latest } = createPresented();

    expect(latest()).toEqual({
      principal: DESIGN_PRINCIPAL,
      firm: DESIGN_FIRM,
      preferences: DEFAULT_PREFERENCES,
    });
  });

  it("setMode, setTheme and setLanguage each patch one preference", async () => {
    const { presenter, latest } = createPresented();

    expect(await presenter.setMode("dark")).toEqual({ ok: true });
    expect(latest().preferences).toEqual({
      mode: "dark",
      theme: "slate",
      language: "en",
    });

    expect(await presenter.setTheme("sage")).toEqual({ ok: true });
    expect(latest().preferences).toEqual({
      mode: "dark",
      theme: "sage",
      language: "en",
    });

    expect(await presenter.setLanguage("it")).toEqual({ ok: true });
    expect(latest().preferences).toEqual({
      mode: "dark",
      theme: "sage",
      language: "it",
    });
  });
});

interface Latest {
  principal: Principal | null;
  firm: Firm | null;
  preferences: Preferences | null;
}

interface Presented {
  presenter: SessionPresenter;
  latest: () => Latest;
}

function createPresented(): Presented {
  const presenter = createSessionPresenter(
    createSessionSimulator({ principal: DESIGN_PRINCIPAL, firm: DESIGN_FIRM }),
  );
  const latest: Latest = { principal: null, firm: null, preferences: null };

  presenter.principal$.subscribe((next) => {
    latest.principal = next;
  });
  presenter.firm$.subscribe((next) => {
    latest.firm = next;
  });
  presenter.preferences$.subscribe((next) => {
    latest.preferences = next;
  });

  return {
    presenter,
    latest: () => {
      return latest;
    },
  };
}
