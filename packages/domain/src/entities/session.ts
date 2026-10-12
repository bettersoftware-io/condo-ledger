/** The session is who is signed in, for which firm, with which display preferences. */
type Role = "administrator" | "owner";

export interface Principal {
  username: string;
  displayName: string;
  role: Role;
}

export interface Firm {
  name: string;
}

type Mode = "light" | "dark";

type Theme = "slate" | "carbon" | "sage";

type Language = "en" | "it" | "fr" | "de" | "es";

export interface Preferences {
  mode: Mode;
  theme: Theme;
  language: Language;
}

export const DEFAULT_PREFERENCES: Preferences = {
  mode: "light",
  theme: "slate",
  language: "en",
};
