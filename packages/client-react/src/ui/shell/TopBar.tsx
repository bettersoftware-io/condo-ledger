import { ChevronDown, Moon, Sun } from "lucide-react";
import { type ReactElement, useState } from "react";

import type { Language, Principal, Result, Theme } from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { TESTIDS } from "../testids.ts";
import { FLAGS } from "./icons.tsx";
import { Logo } from "./Logo.tsx";
import { ModuleTabs } from "./ModuleTabs.tsx";
import { Popover } from "./Popover.tsx";

import "./TopBar.css";

/**
 * The chrome: the logo, who is signed in, the mode, theme and language
 * pickers, log out, and the module tabs. Reads the session, the navigation
 * and the notices; which picker is open is the view's own state.
 */
export function TopBar(): ReactElement {
  const { useSession, useNavigation, useNotices } = useViewModel();
  const { principal, firm, preferences, setMode, setTheme, setLanguage } =
    useSession();
  const navigation = useNavigation();
  const { stub } = useNotices();
  const [picker, setPicker] = useState<Picker | null>(null);
  const dark = preferences.mode === "dark";

  function toggleMode(): void {
    save(setMode(dark ? "light" : "dark"));
  }

  function openThemes(): void {
    setPicker("theme");
  }

  function openLanguages(): void {
    setPicker("language");
  }

  function closePicker(): void {
    setPicker(null);
  }

  function pickingTheme(theme: Theme): () => void {
    return (): void => {
      setPicker(null);
      save(setTheme(theme));
    };
  }

  function pickingLanguage(language: Language): () => void {
    return (): void => {
      setPicker(null);
      save(setLanguage(language));
    };
  }

  function stubLogOut(): void {
    stub("Log out");
  }

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <Logo />
        <div className="topbar-wordmark">
          <div className="topbar-name">CONDO LEDGER</div>
          <div className="topbar-tagline">Condominium Admin</div>
        </div>
      </div>
      <div className="topbar-spacer" />
      <div className="topbar-right">
        <div className="topbar-row">
          <div className="topbar-account" data-testid={TESTIDS.accountLine}>
            <span>
              Account <b>{principal?.username}</b> · {principal?.displayName}
            </span>
            <span className="topbar-separator">|</span>
            <span>
              Profile <b>{ROLES[principal?.role ?? "administrator"]}</b>
            </span>
            <span className="topbar-separator">|</span>
            <span>
              Firm <b>{firm?.name}</b>
            </span>
          </div>
          <div className="topbar-controls">
            <button
              type="button"
              className="topbar-chrome-button topbar-mode"
              data-testid={TESTIDS.modeToggle}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggleMode}
            >
              {dark ? <Moon size={13} /> : <Sun size={13} />}
            </button>
            <div className="topbar-anchor">
              <button
                type="button"
                className="topbar-chrome-button"
                data-testid={TESTIDS.themeButton}
                aria-haspopup="menu"
                aria-expanded={picker === "theme"}
                onClick={openThemes}
              >
                <span
                  className="topbar-swatch"
                  data-theme={preferences.theme}
                  data-mode={preferences.mode}
                />
                {THEME_NAMES[preferences.theme]}
                <ChevronDown className="topbar-chevron" size={11} />
              </button>
              <Popover
                open={picker === "theme"}
                label="Theme"
                onClose={closePicker}
              >
                {THEMES.map((theme) => {
                  return (
                    <button
                      key={theme}
                      type="button"
                      className="popover-option"
                      role="menuitemradio"
                      aria-checked={theme === preferences.theme}
                      onClick={pickingTheme(theme)}
                    >
                      <span
                        className="topbar-swatch topbar-swatch-option"
                        data-theme={theme}
                        data-mode={preferences.mode}
                      />
                      <span className="popover-option-name">
                        {THEME_NAMES[theme]}
                      </span>
                      <span className="popover-option-check" aria-hidden="true">
                        ✓
                      </span>
                    </button>
                  );
                })}
              </Popover>
            </div>
          </div>
          <div className="topbar-controls">
            <div className="topbar-anchor">
              <button
                type="button"
                className="topbar-chrome-button topbar-language"
                data-testid={TESTIDS.languageButton}
                aria-label={`Language: ${LANGUAGE_NAMES[preferences.language]}`}
                aria-haspopup="menu"
                aria-expanded={picker === "language"}
                onClick={openLanguages}
              >
                {FLAGS[preferences.language]}
                <ChevronDown className="topbar-chevron" size={11} />
              </button>
              <Popover
                open={picker === "language"}
                label="Language"
                width="wide"
                onClose={closePicker}
              >
                {LANGUAGES.map((language) => {
                  return (
                    <button
                      key={language}
                      type="button"
                      className="popover-option"
                      role="menuitemradio"
                      aria-checked={language === preferences.language}
                      onClick={pickingLanguage(language)}
                    >
                      {FLAGS[language]}
                      <span className="popover-option-name">
                        {LANGUAGE_NAMES[language]}
                      </span>
                      <span className="popover-option-check" aria-hidden="true">
                        ✓
                      </span>
                    </button>
                  );
                })}
              </Popover>
            </div>
            <button
              type="button"
              className="topbar-log-out"
              data-testid={TESTIDS.logOut}
              onClick={stubLogOut}
            >
              ✕ Log out
            </button>
          </div>
        </div>
        <ModuleTabs
          active={navigation.state.module}
          onSelect={navigation.selectModule}
        />
      </div>
    </header>
  );
}

type Picker = "theme" | "language";

const ROLES: Record<Principal["role"], string> = {
  administrator: "Administrator",
  owner: "Owner",
};

const THEMES: readonly Theme[] = ["slate", "carbon", "sage"];

const THEME_NAMES: Record<Theme, string> = {
  slate: "Slate",
  carbon: "Carbon",
  sage: "Sage",
};

const LANGUAGES: readonly Language[] = ["en", "it", "fr", "de", "es"];

const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  it: "Italiano",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
};

/** Saves a preference the person picked. A refused one leaves the session's stream as it was, so the screen stays true. */
function save(saving: Promise<Result>): void {
  // A click waits for nothing: the saved preference comes back on the session's stream, which redraws the root.
  void saving.catch(reportUnsaved);
}

/* v8 ignore next 3 -- only a real session store can fail to answer; the simulator always does */
function reportUnsaved(error: unknown): void {
  console.error("the preference was not saved", error);
}
