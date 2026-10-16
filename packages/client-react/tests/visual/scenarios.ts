import type { GenericLine } from "@cl/client-core";

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
  /** Accounts given another name, by id: a label the seed does not have. */
  renamed?: Record<string, string>;
  /** The Buildings menu item on screen; Accounts when absent. */
  menu?: "accounts" | "journal";
  /** The journal entries open, by id. */
  expandedEntries?: string[];
  /** The journal entry selected, by id, on the page that holds it. */
  selectedEntry?: string;
  /** A dialog open over the Journal, with what is typed in it. */
  dialog?: ScenarioDialog;
}

/** The generic wizard, with its description and lines typed. */
interface GenericEntryDialog {
  wizard: "genericEntry";
  description: string;
  lines: GenericLine[];
}

/** A wizard with its form as typed, or the delete confirmation of the selected entry. */
type ScenarioDialog = GenericEntryDialog | "delete";

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
 * The Journal of the same period: entry 2 (`tx150`, an invoice of three
 * postings) open and selected, and two dialogs over it.
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
  // The selected cash account under a name far wider than the tree column:
  // the label is cut with an ellipsis and the amounts stay in their columns.
  "accounts-long-label": {
    width: 1280,
    mode: "light",
    periodId: "p36",
    selectedKey: "la154",
    expanded: OPEN_TO_CASH,
    renamed: {
      la154:
        "Cassa contanti per le piccole spese della gestione ordinaria, straordinaria e del riscaldamento, con il riporto dei saldi dell'esercizio precedente",
    },
  },
  "journal-1280-light": {
    width: 1280,
    mode: "light",
    periodId: "p36",
    menu: "journal",
    expandedEntries: ["tx150"],
    selectedEntry: "tx150",
  },
  "journal-1280-dark": {
    width: 1280,
    mode: "dark",
    periodId: "p36",
    menu: "journal",
    expandedEntries: ["tx150"],
    selectedEntry: "tx150",
  },
  // Two lines that do not balance, typed: the balance message shows under
  // the postings, and Save is disabled.
  "journal-wizard-generic": {
    width: 1280,
    mode: "light",
    periodId: "p36",
    menu: "journal",
    dialog: {
      wizard: "genericEntry",
      description: "Nota di credito",
      lines: [
        { scopeKey: "la154", debit: "50", credit: "" },
        { scopeKey: "la173", debit: "", credit: "30" },
      ],
    },
  },
  // No direct payment has a golden. On linux-x64 Chromium shades the
  // rounded corners of boxes that land on fractional heights inside the
  // dialog one or two levels apart from run to run, and the bank purchase's
  // scrolling list flickers between frames; docs/STATUS.md holds the choice
  // the visual add-on needs.
  // Entry 41 (`tx109`, a generic entry), selected on its page, and the
  // question whether to delete it.
  "journal-delete-confirm": {
    width: 1280,
    mode: "light",
    periodId: "p36",
    menu: "journal",
    selectedEntry: "tx109",
    dialog: "delete",
  },
};
