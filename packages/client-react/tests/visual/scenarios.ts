/**
 * One picture: a name and the state the screen is in when it is taken. The
 * state is data, never a click. The visual host turns it into deliveries on
 * the app harness, so the real presenters decide what the screen looks like.
 */
export interface Scenario {
  /** The page's width in pixels; the height is the same for every scenario. */
  width: number;
  /** The colour mode, set as the person would set it. */
  mode: "light" | "dark";
  /** The period the sidebar has selected. */
  periodId: string;
  /** The account the grid has selected; Total when absent. */
  selectedKey?: string;
  /** The grid's open rows; the grid's own starting set when absent. */
  expanded?: string[];
  /** Whether the sidebar is open as a drawer over the screen (compact widths). */
  drawerOpen?: boolean;
}

/** Total, the five levels, and the cash account's group: the cash account in view. */
const OPEN_TO_CASH = [
  "total",
  "patrimonial",
  "assets",
  "liabilities",
  "costs",
  "revenue",
  "la153",
];

/**
 * Every scenario, keyed by name. The name is the golden's file name
 * (`goldens/<platform>/<name>.png`) and the test's title, so keep it short,
 * lower-case and dashed. Each scenario needs a golden on every platform that
 * runs the tier; `pnpm visual` says which are missing. Pozzetto 2013 (`p36`)
 * with its cash account (`la154`) selected, at the full layout (1280) and the
 * compact one (1100, the sidebar folded to its rail or open as a drawer).
 */
export const scenarios: Record<string, Scenario> = {
  "accounts-1280-light": {
    width: 1280,
    mode: "light",
    periodId: "p36",
    selectedKey: "la154",
    expanded: OPEN_TO_CASH,
  },
  "accounts-1280-dark": {
    width: 1280,
    mode: "dark",
    periodId: "p36",
    selectedKey: "la154",
    expanded: OPEN_TO_CASH,
  },
  "accounts-1100-light": {
    width: 1100,
    mode: "light",
    periodId: "p36",
    selectedKey: "la154",
    expanded: OPEN_TO_CASH,
  },
  "accounts-1100-drawer": {
    width: 1100,
    mode: "light",
    periodId: "p36",
    selectedKey: "la154",
    expanded: OPEN_TO_CASH,
    drawerOpen: true,
  },
};
