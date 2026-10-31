import type {
  DirectPaymentKind,
  GenericLine,
  GroupDialogState,
  InvoiceForm,
  MultiCostPaymentForm,
  OpeningAmount,
  OwnerDialogState,
  PeriodDialogState,
  SettlementRow,
} from "@cl/client-core";
import {
  type AccountNature,
  type AllocationMode,
  type CellStatus,
  cents,
  type EntryKind,
  type Language,
  type NodeIcon,
} from "@cl/domain";

import type { Picture } from "./host/picture.ts";

/**
 * One picture: a name and the state the screen is in when it is taken. The
 * state is data, never a click. The visual host turns it into deliveries on
 * the app harness, so the real presenters decide what the screen looks like.
 *
 * The fields of `Picture` say what is pictured. A scenario with no `mount` is
 * a page: the whole app in a viewport of its `width` and `height`. One with a
 * `mount` is a part of the UI shown alone, the entry of that name in
 * `registry.tsx`: a dialog in a viewport of its own size, anything else as a
 * root capture of its content's height.
 */
export interface Scenario extends Picture {
  /** The picture's width in pixels: a page's full layout at 1280, its compact one under 1180; a part's width as the app gives it. */
  width: number;
  /** The viewport's height in pixels, for a page or a dialog: 720 for every one, the size the pictures were drawn at before 0.19.0. None for a root capture, which has its content's height. */
  height?: number;
  /** The colour mode, set as the person would set it. */
  mode: "light" | "dark";
  /** The language, set as the person would pick it, so amounts are in its locale; English when absent. */
  language?: Language;
  /** The period the sidebar has selected; none for a part drawn from its props alone. */
  periodId?: string;
  /** The account the grid has selected; Total when absent. */
  selectedKey?: string;
  /** The grid's open rows; the grid's own starting set when absent. */
  expanded?: string[];
  /** Whether the sidebar is open as a drawer over the screen (compact widths). */
  drawerOpen?: boolean;
  /** Accounts given another name, by id: a label the seed does not have. */
  renamed?: Record<string, string>;
  /** The Buildings menu item on screen; Accounts when absent. */
  menu?:
    | "data"
    | "units"
    | "accounts"
    | "journal"
    | "installments"
    | "thousandths";
  /** The seed the app runs on: the generated one when absent; `schedule`, the test seed whose 2015 (`p3`) has books and no installments. */
  seed?: "schedule";
  /** The journal entries open, by id. */
  expandedEntries?: string[];
  /** The journal entry selected, by id, on the page that holds it. */
  selectedEntry?: string;
  /** A dialog open over the Journal, with what is typed in it; for a wizard mounted alone (`mount: "invoice-wizard"`, `"opening-balances-wizard"`), what is typed in it. */
  dialog?: ScenarioDialog;
  /** The Record owner collection wizard mounted alone (`mount: "collection-wizard"`), on the step it shows. */
  collection?: CollectionStep;
  /** The settlement table's rows (`mount: "settlement-table"`), as its props. */
  settlement?: SettlementRow[];
  /** The Create Budget Installments wizard mounted alone (`mount: "budget-installments-wizard"`), on the step it shows. */
  budgetInstallments?: BudgetInstallmentsStep;
  /** The installment the Edit Installment dialog opens on (`mount: "installment-dialog"`). */
  installmentId?: string;
  /** The installment cells (`mount: "installment-cells"`), one under another, as their props. */
  cells?: CellPicture[];
  /** A money cell (`mount: "money"`), as its props. */
  money?: MoneyPicture;
  /** Money cells one under another (`mount: "money-column"`), as their props: one picture of a locale's amounts. */
  moneys?: MoneyPicture[];
  /** Rows of the chart of accounts as the grid draws them: one alone (`mount: "tree-grid-row"`), or the grid's (`mount: "tree-grid"`), none for its empty state. */
  accountRows?: AccountRowPicture[];
  /** The inline editor (`mount: "inline-editor"`), as its props. */
  editor?: EditorPicture;
  /** The segmented control (`mount: "segmented-control"`), as its props. */
  segments?: SegmentsPicture;
  /** The yes-or-no question (`mount: "confirm-alert"`), as its props. */
  confirm?: ConfirmPicture;
  /** Any wizard's dialog (`mount: "wizard-dialog"`), as its props, over one field of a body. */
  wizardDialog?: WizardDialogPicture;
  /** The multi-cost payment wizard mounted alone (`mount: "multi-cost-payment-wizard"`), with what is typed in it, one field at a time. */
  multiCost?: MultiCostPaymentForm;
  /** The New invoice wizard mounted alone (`mount: "invoice-wizard"`) on step 1, its fields typed in the order written. */
  invoice?: Partial<InvoiceForm>;
  /** A popover menu (`mount: "popover"`), open, as its props: its label and its items. */
  popover?: PopoverPicture;
  /** The controls whose stub notice is on screen (`mount: "toast-host"`), in the order pressed. */
  stubbed?: string[];
  /** The tab the Accounts screen's bottom panel shows (`mount: "accounts-bottom-panel"`), over the account `selectedKey` names. */
  bottomTab?: "Account Details" | "Ledger";
  /** The thousandth table selected, by id, as a click on the Thousandth Tables panel selects it; the period's first when absent. */
  tableId?: string;
  /** The allocation the Allocation panel shows, as its mode menu chooses it; the budget's when absent. */
  allocationMode?: AllocationMode;
  /** The name typed in the New Thousandth Table dialog (`mount: "table-dialog"`). */
  tableName?: string;
  /** A journal entry of the period deleted through the journal port before the part mounts (a wizard mounted alone over books without it). */
  deletedEntry?: string;
  /** The Units grid's selected row, by key (`unit:u5`, `root`), as a click selects it; the period's first unit when absent. */
  unitKey?: string;
  /** The tab the Units screen's bottom panel shows, as a click on it chooses it; Unit Profile when absent. */
  unitTab?: "Unit Profile" | "Unit Owners";
  /** The tab the Building Data screen's bottom panel shows, as a click on it chooses it; Building Profile when absent. */
  buildingTab?: "Building Profile" | "Building Suppliers";
  /** The supplier selected in the Building Suppliers tab, by contact id; the building's first when absent. */
  supplierId?: string;
  /** The resident the Edit Owner dialog opens on (`mount: "owner-dialog"`); the Add Owner dialog on the selected unit when absent. */
  residentId?: string;
  /** What is typed in the New Group dialog (`mount: "group-dialog"`), one field at a time in the order written. */
  groupForm?: Partial<GroupDialogState["form"]>;
  /** What is typed in the owner dialog (`mount: "owner-dialog"`), one field at a time in the order written. */
  ownerForm?: Partial<OwnerDialogState["form"]>;
  /** What is typed in the Edit Management / Period dialog (`mount: "period-dialog"`), one field at a time in the order written. */
  periodForm?: Partial<PeriodDialogState["form"]>;
}

/** The budget wizard on a step: the first due date typed on step 1, the other fields as they open, then moved on through its own Next. */
interface BudgetInstallmentsStep {
  step: 1 | 2 | 3;
  firstDue: string;
}

/** A money cell as its props: the amount in cents (null for a blank cell), its variant, and whether it is an aggregate's. */
interface MoneyPicture {
  cents: number | null;
  variant: "colored" | "plain";
  emphasis: boolean;
}

/** A row of the chart of accounts, as the Accounts grid makes it: the node's glyph, label and amounts in cents; a row with children has a bold label. */
export interface AccountRowPicture {
  key: string;
  label: string;
  depth: number;
  icon: NodeIcon;
  nature: AccountNature | null;
  /** Total, the top of the tree: drawn with Σ. */
  root: boolean;
  /** The row's place among the grid's visible rows, from 0: an even place is on a stripe. */
  position: number;
  hasChildren: boolean;
  expanded: boolean;
  selected: boolean;
  debit: number;
  credit: number;
  balance: number;
}

/** The inline editor as its props: the text it opens on, and what is wrong with the text committed. */
interface EditorPicture {
  value: string;
  error: string | null;
}

/** The segmented control as its props. */
interface SegmentsPicture {
  label: string;
  options: { value: string; label: string }[];
  value: string;
}

/** The yes-or-no question as its props. */
interface ConfirmPicture {
  text: string;
  error: string | null;
}

/** Any wizard's dialog as its props: where it stands, what it would write, and why it cannot go on. Its body is one Description field. */
interface WizardDialogPicture {
  name: string;
  /** None for a wizard of one step. */
  stepTitle?: string;
  step: number;
  stepCount: number;
  /** An edit of an entry: titled "Edit {name}". */
  editing: boolean;
  description: string;
  /** The domain's reason the step (the whole draft, on the last) cannot go on, after an edit, worded as every wizard words it; null when it can. */
  reason: string | null;
  writesEntry: boolean;
  /** The "Entry postings", in cents. */
  preview: { path: string; debit: number; credit: number }[];
}

/** A popover menu as its props: its label, and one item per entry kind, the kind's glyph before the label. */
interface PopoverPicture {
  label: string;
  items: { label: string; kind: EntryKind }[];
}

/** One installment cell as its props: what it owes in cents (null for no item), its settlement, and whether a click edits it. */
export interface CellPicture {
  amount: number | null;
  status: CellStatus | null;
  editable: boolean;
}

/** The collection wizard as it opens: step 1, no owner chosen. */
interface CollectionOwnerStep {
  step: 1;
}

/** The collection wizard on step 2: an owner chosen, then the amount typed over the prefilled one. */
interface CollectionAmountStep {
  step: 2;
  personId: string;
  amount: string;
}

type CollectionStep = CollectionOwnerStep | CollectionAmountStep;

/** The generic wizard, with its description and lines typed. */
interface GenericEntryDialog {
  wizard: "genericEntry";
  description: string;
  lines: GenericLine[];
}

/** A direct payment (the bank purchase today), with its cost account chosen and its amount typed. */
interface DirectPaymentDialog {
  wizard: DirectPaymentKind;
  targetId: string;
  amount: string;
}

/** The New invoice wizard on a step, with its fields typed one at a time in the order written: the supplier first, so its prefill comes before the rest. */
interface InvoiceDialog {
  wizard: "invoice";
  step: 2;
  form: Partial<InvoiceForm>;
}

/** The Invoice payment wizard on its first step, the open invoices listed. */
interface InvoicePaymentDialog {
  wizard: "invoicePayment";
}

/** The Opening balances wizard on a new opening: the period's seeded one deleted first, then the scenario's rows typed over the prefill. */
interface OpeningBalancesDialog {
  wizard: "openingBalances";
  deleteSeeded: true;
  /** By row key. */
  amounts: Record<string, OpeningAmount>;
}

/** The entry's own editor open on it, as `✎` opens it. */
interface EditDialog {
  edit: string;
}

/** A wizard on a new entry, with its form as typed. */
export type NewEntryDialog =
  | GenericEntryDialog
  | DirectPaymentDialog
  | InvoiceDialog
  | InvoicePaymentDialog
  | OpeningBalancesDialog;

/** A wizard on a new entry, an entry in its editor, or the delete confirmation of the selected entry. */
type ScenarioDialog = NewEntryDialog | EditDialog | "delete";

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

/** The cash account's row, selected under its group: a leaf, so neither bold nor with a caret. */
const CASH_ROW: AccountRowPicture = {
  key: "la154",
  label: "Cash on hand",
  depth: 4,
  icon: "cash",
  nature: "assets",
  root: false,
  position: 5,
  hasChildren: false,
  expanded: false,
  selected: true,
  debit: 312000,
  credit: 287450,
  balance: 24550,
};

/**
 * Every scenario, keyed by name. The name is the golden's file name
 * (`goldens/<platform>/<name>.png`) and the test's title, so keep it short,
 * lower-case and dashed. Each scenario needs a golden on every platform that
 * runs the tier; `pnpm visual` says which are missing. Pozzetto 2013 (`p36`)
 * with its cash account (`la154`) selected, at the full layout (1280) and the
 * compact one (1100, the sidebar folded to its rail or open as a drawer).
 * The Journal of the same period: entry 2 (`tx150`, an invoice of three
 * postings) open and selected, and the dialogs over it. Then the parts shown
 * alone: the Record owner collection wizard, a dialog in a viewport of the
 * app's page height, and its settlement table at the width it has in the
 * wizard's body. The Installment Schedule of the same period, and its parts
 * alone: the cells in each state, the Create Budget Installments wizard over
 * a period with no schedule, and the Edit Installment dialog. Saturno 2011's
 * Thousandth Tables & Allocation, its panels, the table dialog and the Budget
 * allocation wizard alone, and Account Details' tables mini-grid. Saturno's
 * schedule panel alone, with its groups; the Units and Building Data screens,
 * their panels and their dialogs alone. Then the
 * pyramid's base, the small components in each state that matters, from
 * their props or over the same period; and two sections of the Accounts
 * screen's bottom panel, each tab alone.
 */
/** What a locale's money column shows: 1.234.567,89 / -1.250,50 / 0,00 in it-IT. */
const LOCALE_MONEYS: MoneyPicture[] = [
  { cents: 123456789, variant: "colored", emphasis: false },
  { cents: -125050, variant: "colored", emphasis: false },
  { cents: 0, variant: "colored", emphasis: false },
];

export const scenarios: Record<string, Scenario> = {
  "accounts-1280-light": {
    width: 1280,
    height: 720,
    mode: "light",
    periodId: "p36",
    selectedKey: "la154",
    expanded: OPEN_TO_CASH,
  },
  // The same screen in Italian: every amount of the grid and the bottom
  // panel in it-IT, `1.234,56`.
  "accounts-1280-light-it": {
    width: 1280,
    height: 720,
    mode: "light",
    language: "it",
    periodId: "p36",
    selectedKey: "la154",
    expanded: OPEN_TO_CASH,
  },
  "accounts-1280-dark": {
    width: 1280,
    height: 720,
    mode: "dark",
    periodId: "p36",
    selectedKey: "la154",
    expanded: OPEN_TO_CASH,
  },
  "accounts-1100-light": {
    width: 1100,
    height: 720,
    mode: "light",
    periodId: "p36",
    selectedKey: "la154",
    expanded: OPEN_TO_CASH,
  },
  "accounts-1100-drawer": {
    width: 1100,
    height: 720,
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
    height: 720,
    mode: "light",
    periodId: "p36",
    selectedKey: "la154",
    expanded: OPEN_TO_CASH,
    renamed: {
      la154:
        "Cash on hand for the petty expenses of the ordinary, extraordinary and heating management, with the balances carried over from the previous financial year",
    },
  },
  "journal-1280-light": {
    width: 1280,
    height: 720,
    mode: "light",
    periodId: "p36",
    menu: "journal",
    expandedEntries: ["tx150"],
    selectedEntry: "tx150",
  },
  "journal-1280-dark": {
    width: 1280,
    height: 720,
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
    height: 720,
    mode: "light",
    periodId: "p36",
    menu: "journal",
    dialog: {
      wizard: "genericEntry",
      description: "Credit note",
      lines: [
        { scopeKey: "la154", debit: "50", credit: "" },
        { scopeKey: "la173", debit: "", credit: "30" },
      ],
    },
  },
  // The purchase paid from the bank: a cost account chosen and an amount
  // typed. Its cost list is long enough that the dialog meets its 90vh
  // ceiling: the list gives way and scrolls, and the body does not.
  "journal-wizard-direct": {
    width: 1280,
    height: 720,
    mode: "light",
    periodId: "p36",
    menu: "journal",
    dialog: {
      wizard: "directPaymentBank",
      targetId: "la173",
      amount: "1,200.00",
    },
  },
  // Entry 41 (`tx109`, a generic entry), selected on its page, and the
  // question whether to delete it, open with the focus on No.
  "journal-delete-confirm": {
    width: 1280,
    height: 720,
    mode: "light",
    periodId: "p36",
    menu: "journal",
    selectedEntry: "tx109",
    dialog: "delete",
  },
  // Step 2 of a new invoice from a seeded supplier (`md78`): its last
  // invoice prefills the cost account, the rates and the withholding code,
  // and the computed rows follow the typed taxable amount.
  "journal-wizard-invoice": {
    width: 1280,
    height: 720,
    mode: "light",
    periodId: "p36",
    menu: "journal",
    dialog: {
      wizard: "invoice",
      step: 2,
      form: { supplierId: "md78", number: "3200", taxable: "300.15" },
    },
  },
  // Step 1 of an invoice payment: the period's open invoices to choose from.
  "journal-wizard-payment": {
    width: 1280,
    height: 720,
    mode: "light",
    periodId: "p36",
    menu: "journal",
    dialog: { wizard: "invoicePayment" },
  },
  // A new opening over the period, its seeded one (`tx100`) deleted: the
  // owners prefilled from their starting balances, and the bank (`la156`)
  // typed.
  "journal-wizard-opening": {
    width: 1280,
    height: 720,
    mode: "light",
    periodId: "p36",
    menu: "journal",
    dialog: {
      wizard: "openingBalances",
      deleteSeeded: true,
      amounts: { la156: { debit: "6,250.99", credit: "" } },
    },
  },
  // The first generic entry of the period by number (entry 41, `tx109`),
  // selected and open in its editor.
  "journal-wizard-edit": {
    width: 1280,
    height: 720,
    mode: "light",
    periodId: "p36",
    menu: "journal",
    selectedEntry: "tx109",
    dialog: { edit: "tx109" },
  },
  // Step 1 of a collection over Pozzetto 2013: the owners who still owe an
  // installment, one row each across their units, none chosen yet.
  "collection-wizard-owner": {
    level: "component",
    mount: "collection-wizard",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    periodId: "p36",
    collection: { step: 1 },
  },
  // Step 2 for the owner of A01 (`md89`, who owes Installment 9 to 12, 134.98
  // each), 300.00 typed: Installments 9 and 10 are settled, 11 in part.
  "collection-wizard-amount": {
    level: "component",
    mount: "collection-wizard",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    periodId: "p36",
    collection: { step: 2, personId: "md89", amount: "300.00" },
  },
  // The settlement table alone, at the width of the wizard's body (680 less
  // its borders and padding): three rows, the last paid in part.
  "collection-settlement-partial": {
    level: "component",
    mount: "settlement-table",
    width: 642,
    mode: "light",
    settlement: [
      createSettlementRow("Installment 9", "2013-09-20", 13498, 13498),
      createSettlementRow("Installment 10", "2013-10-20", 13498, 13498),
      createSettlementRow("Installment 11", "2013-11-20", 13498, 3004),
    ],
  },
  // Pozzetto 2013's schedule: the units open, their residents' items
  // coloured by what is paid of them; at this width the first two
  // installments are in view.
  "installments-1280-light": {
    width: 1280,
    height: 720,
    mode: "light",
    periodId: "p36",
    menu: "installments",
  },
  // Saturno 2011's Thousandth Tables & Allocation: its five tables, the
  // first selected with its coefficients beside it, and the budget's
  // allocation under them.
  "allocation-1280-light": {
    width: 1280,
    height: 720,
    mode: "light",
    periodId: "p1",
    menu: "thousandths",
  },
  // One cell per settlement, from the top: settled, partial, unsettled,
  // nothing owed, no item (blank); then an unsettled one a click edits,
  // drawn as the others until it is hovered.
  "installment-cell-states": {
    level: "component",
    mount: "installment-cells",
    width: 120,
    mode: "light",
    cells: [
      { amount: 13498, status: "settled", editable: false },
      { amount: 13498, status: "partial", editable: false },
      { amount: 13498, status: "unsettled", editable: false },
      { amount: 0, status: null, editable: false },
      { amount: null, status: null, editable: false },
      { amount: 13498, status: "unsettled", editable: true },
    ],
  },
  // Step 2 over 2015 of the test seed, which has books and no installments:
  // the first due date typed on step 1, three installments four months
  // apart on the default shares, 34, 33 and 33.
  "budget-installments-wizard-step2": {
    level: "component",
    mount: "budget-installments-wizard",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    seed: "schedule",
    periodId: "p3",
    budgetInstallments: { step: 2, firstDue: "31/03/2015" },
  },
  // Saturno 2011's first installment (`in1`, Installment 1), locked: its name
  // and due date cannot change until Locked is unticked.
  "installment-dialog": {
    level: "component",
    mount: "installment-dialog",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    periodId: "p1",
    installmentId: "in1",
  },

  // The pyramid's base: the small components alone, one state each, from
  // their props. A width is the one the app gives the component.

  // A money cell in an amount column (100 wide, less its padding): blue when
  // positive, red when negative, grey at zero; the Journal's and Ledger's
  // Debit and Credit in the text's colour; an aggregate's bold.
  "money-positive": {
    level: "component",
    mount: "money",
    width: 100,
    mode: "light",
    money: { cents: 125050, variant: "colored", emphasis: false },
  },
  "money-negative": {
    level: "component",
    mount: "money",
    width: 100,
    mode: "light",
    money: { cents: -125050, variant: "colored", emphasis: false },
  },
  "money-zero": {
    level: "component",
    mount: "money",
    width: 100,
    mode: "light",
    money: { cents: 0, variant: "colored", emphasis: false },
  },
  // A locale's amounts, one cell under another: positive, negative and zero,
  // each grouped and with the locale's decimal separator. Italian groups with
  // dots; French with narrow no-break spaces.
  "money-column-it-it": {
    level: "component",
    mount: "money-column",
    width: 100,
    mode: "light",
    language: "it",
    moneys: LOCALE_MONEYS,
  },
  "money-column-fr-fr": {
    level: "component",
    mount: "money-column",
    width: 100,
    mode: "light",
    language: "fr",
    moneys: LOCALE_MONEYS,
  },
  "money-plain": {
    level: "component",
    mount: "money",
    width: 100,
    mode: "light",
    money: { cents: 125050, variant: "plain", emphasis: false },
  },
  "money-emphasis": {
    level: "component",
    mount: "money",
    width: 100,
    mode: "light",
    money: { cents: -125050, variant: "colored", emphasis: true },
  },
  // One row of the chart of accounts, under the grid's first four columns at
  // their default widths: Total with Σ, first and so on a stripe; an open
  // group, its label bold, on a stripe; a closed one off the stripes; the
  // cash account selected; a label far wider than its column, cut with an
  // ellipsis; and the selected row in the dark mode.
  "tree-grid-row-total": {
    level: "component",
    mount: "tree-grid-row",
    width: 700,
    mode: "light",
    accountRows: [
      {
        key: "total",
        label: "Total",
        depth: 0,
        icon: "folder",
        nature: null,
        root: true,
        position: 0,
        hasChildren: true,
        expanded: true,
        selected: false,
        debit: 4821733,
        credit: 4821733,
        balance: 0,
      },
    ],
  },
  "tree-grid-row-aggregate": {
    level: "component",
    mount: "tree-grid-row",
    width: 700,
    mode: "light",
    accountRows: [
      {
        key: "assets",
        label: "Assets",
        depth: 2,
        icon: "folder",
        nature: "assets",
        root: false,
        position: 2,
        hasChildren: true,
        expanded: true,
        selected: false,
        debit: 1893210,
        credit: 1250400,
        balance: 642810,
      },
    ],
  },
  "tree-grid-row-collapsed": {
    level: "component",
    mount: "tree-grid-row",
    width: 700,
    mode: "light",
    accountRows: [
      {
        key: "costs",
        label: "Costs",
        depth: 1,
        icon: "folder",
        nature: "expenses",
        root: false,
        position: 11,
        hasChildren: true,
        expanded: false,
        selected: false,
        debit: 1042975,
        credit: 0,
        balance: 1042975,
      },
    ],
  },
  "tree-grid-row-selected": {
    level: "component",
    mount: "tree-grid-row",
    width: 700,
    mode: "light",
    accountRows: [CASH_ROW],
  },
  "tree-grid-row-long-label": {
    level: "component",
    mount: "tree-grid-row",
    width: 700,
    mode: "light",
    accountRows: [
      {
        ...CASH_ROW,
        selected: false,
        label:
          "Cash on hand for the petty expenses of the ordinary, extraordinary and heating management",
      },
    ],
  },
  "tree-grid-row-selected-dark": {
    level: "component",
    mount: "tree-grid-row",
    width: 700,
    mode: "dark",
    accountRows: [CASH_ROW],
  },
  // The grid with no row: its header, and the message in place of the rows.
  "tree-grid-empty": {
    level: "component",
    mount: "tree-grid",
    width: 700,
    mode: "light",
    accountRows: [],
  },
  // The inline editor in a budget cell (90 wide, less its padding), as it
  // opens on the cell's amount, and refused under the text committed.
  "inline-editor-editing": {
    level: "component",
    mount: "inline-editor",
    width: 74,
    mode: "light",
    editor: { value: "1,200.00", error: null },
  },
  "inline-editor-refused": {
    level: "component",
    mount: "inline-editor",
    width: 74,
    mode: "light",
    editor: { value: "1,20", error: "not an amount" },
  },
  // The New invoice wizard's withholding types at the width of the wizard's
  // body, the second chosen.
  "segmented-control": {
    level: "component",
    mount: "segmented-control",
    width: 642,
    mode: "light",
    segments: {
      label: "Withholding type",
      options: [
        { value: "company", label: "Company" },
        {
          value: "professionalWithRegister",
          label: "Professional w/ register",
        },
        {
          value: "professionalWithoutRegister",
          label: "Professional w/o register",
        },
      ],
      value: "professionalWithRegister",
    },
  },
  // The Journal's question before a delete, and the same question after Yes
  // was refused, in the Journal's words. Each opens with the focus on No,
  // which the page, never touched by a pointer, draws as the keyboard's.
  "confirm-alert-question": {
    level: "component",
    mount: "confirm-alert",
    capture: "viewport",
    width: 480,
    height: 240,
    mode: "light",
    confirm: {
      text: 'Delete the entry "Cash payment of postage"?',
      error: null,
    },
  },
  "confirm-alert-refused": {
    level: "component",
    mount: "confirm-alert",
    capture: "viewport",
    width: 480,
    height: 240,
    mode: "light",
    confirm: {
      text: 'Delete the entry "Elevator inspection"?',
      error: "This invoice has payments. Delete them first.",
    },
  },
  // Any wizard's dialog from its props, as the New invoice wizard stands in
  // it: its first step, with no Back and Next enabled; and its last step on
  // an edit, after an edit that left the draft refused: Back, the reason in
  // every wizard's words, and Save disabled. A dialog that writes no entry
  // is the budget wizard's review, below.
  "wizard-dialog-first-step": {
    level: "component",
    mount: "wizard-dialog",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    wizardDialog: {
      name: "New Invoice Entry",
      stepTitle: "Select supplier",
      step: 1,
      stepCount: 2,
      editing: false,
      description: "Elevator inspection",
      reason: null,
      writesEntry: true,
      preview: [
        { path: "Costs › Elevator", debit: 36018, credit: 0 },
        {
          path: "Suppliers › Cargnelutti Elevatori s.n.c.",
          debit: 0,
          credit: 36018,
        },
      ],
    },
  },
  "wizard-dialog-refused": {
    level: "component",
    mount: "wizard-dialog",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    wizardDialog: {
      name: "New Invoice Entry",
      stepTitle: "Calculate withholding",
      step: 2,
      stepCount: 2,
      editing: true,
      description: "Elevator inspection",
      reason: "negative",
      writesEntry: true,
      preview: [
        { path: "Costs › Elevator", debit: 36018, credit: 0 },
        {
          path: "Suppliers › Cargnelutti Elevatori s.n.c.",
          debit: 0,
          credit: 36018,
        },
      ],
    },
  },
  // The bank purchase over several costs, over Pozzetto 2013: 1,000.00 paid,
  // split over the building's insurance (`la173`) and its ordinary
  // administration (`la174`); first in full, then short by 150.00.
  "multi-cost-payment-wizard-balanced": {
    level: "component",
    mount: "multi-cost-payment-wizard",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    periodId: "p36",
    multiCost: {
      description: "Insurance and administration",
      amount: "1,000.00",
      lines: [
        { accountId: "la173", amount: "600.00" },
        { accountId: "la174", amount: "400.00" },
      ],
    },
  },
  "multi-cost-payment-wizard-unbalanced": {
    level: "component",
    mount: "multi-cost-payment-wizard",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    periodId: "p36",
    multiCost: {
      description: "Insurance and administration",
      amount: "1,000.00",
      lines: [
        { accountId: "la173", amount: "600.00" },
        { accountId: "la174", amount: "250.00" },
      ],
    },
  },
  // Step 1 of a new invoice from a seeded supplier (`md78`) under a number it
  // already has in the period (1358, on entry 2): the warning under the
  // number.
  // Step 2 of a new invoice from the same supplier, before a taxable amount
  // is typed: the rates prefilled, every computed row blank.
  "invoice-wizard-step2-blank": {
    level: "component",
    mount: "invoice-wizard",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    periodId: "p36",
    dialog: {
      wizard: "invoice",
      step: 2,
      form: { supplierId: "md78", number: "3200" },
    },
  },
  // Step 2 with non-subject amounts: the Non-taxable amount field shown, and
  // counted into the total.
  "invoice-wizard-non-subject": {
    level: "component",
    mount: "invoice-wizard",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    periodId: "p36",
    dialog: {
      wizard: "invoice",
      step: 2,
      form: {
        supplierId: "md78",
        number: "3200",
        preset: "nonSubject",
        taxable: "300.15",
        nonTaxable: "45.00",
      },
    },
  },
  // A new opening over Pozzetto 2013, its seeded one deleted, with the
  // bank's debit (`la156`) mistyped: the message names the row.
  "opening-balances-wizard-unreadable": {
    level: "component",
    mount: "opening-balances-wizard",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    periodId: "p36",
    dialog: {
      wizard: "openingBalances",
      deleteSeeded: true,
      amounts: { la156: { debit: "6,25o.99", credit: "" } },
    },
  },
  // A screen not built yet: its title, and when it comes.
  placeholder: {
    level: "component",
    mount: "placeholder",
    width: 800,
    mode: "light",
  },
  "invoice-wizard-duplicate-number": {
    level: "component",
    mount: "invoice-wizard",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    periodId: "p36",
    invoice: { supplierId: "md78", number: "1358" },
  },
  // The budget wizard over 2015 of the test seed, as on step 2: its first
  // step with the first due date typed, and its review per resident after
  // step 2's default shares.
  "budget-installments-wizard-step1": {
    level: "component",
    mount: "budget-installments-wizard",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    seed: "schedule",
    periodId: "p3",
    budgetInstallments: { step: 1, firstDue: "31/03/2015" },
  },
  "budget-installments-wizard-review": {
    level: "component",
    mount: "budget-installments-wizard",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    seed: "schedule",
    periodId: "p3",
    budgetInstallments: { step: 3, firstDue: "31/03/2015" },
  },
  // The Journal toolbar's Add transaction menu, open under its button's
  // place: the label, then one item per kind with its glyph. It opens with
  // the focus on its first item, which the page, never touched by a pointer,
  // draws as the keyboard's: New invoice wears the focus ring. A menu hangs from its box
  // out of the flow, over a fixed scrim, so it is pictured as a dialog is, in
  // a viewport of its own size.
  "popover-add-transaction": {
    level: "component",
    mount: "popover",
    capture: "viewport",
    width: 220,
    height: 280,
    mode: "light",
    popover: {
      label: "Add transaction",
      items: [
        { label: "New invoice", kind: "invoice" },
        { label: "Record collection", kind: "collection" },
        { label: "Invoice payment", kind: "invoicePayment" },
        { label: "Direct purchase via bank", kind: "directPaymentBank" },
        { label: "Direct purchase with cash", kind: "directPaymentCash" },
      ],
    },
  },
  // Two notices, bottom right, from two controls not wired yet: the later
  // under the earlier.
  "toast-notices": {
    level: "component",
    mount: "toast-host",
    capture: "viewport",
    width: 480,
    height: 160,
    mode: "light",
    stubbed: ["Print", "Export to PDF"],
  },

  // Thousandth Tables & Allocation's parts alone, over Saturno 2011 (`p1`),
  // each panel at the width it has at the full layout and its content's
  // height. The tables in order, the first selected; the coefficients of
  // Stairs (`dt3`), restricted to group A: only that group and its units; the
  // allocation of the final balance, chosen through the mode menu.
  "thousandth-tables-panel": {
    level: "component",
    mount: "thousandth-tables-panel",
    width: 489,
    mode: "light",
    periodId: "p1",
  },
  "coefficients-stairs-restricted": {
    level: "component",
    mount: "coefficients-panel",
    width: 489,
    mode: "light",
    periodId: "p1",
    tableId: "dt3",
  },
  "allocation-panel-final-balance": {
    level: "component",
    mount: "allocation-panel",
    width: 990,
    mode: "light",
    periodId: "p1",
    allocationMode: "finalBalance",
  },
  // The New Thousandth Table dialog as it opens (the order after the
  // period's last table), and with a name the period already has: the
  // refusal under the fields, and + Add disabled.
  "table-dialog-new": {
    level: "component",
    mount: "table-dialog",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    periodId: "p1",
  },
  "table-dialog-name-taken": {
    level: "component",
    mount: "table-dialog",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    periodId: "p1",
    tableName: "Stairs",
  },
  // The Budget allocation wizard over Saturno 2011 with its allocation
  // (`tx5`) deleted: the whole entry, the eleven debits (each owner's charge
  // and the 0.01 rounding) and the 7,400.00 credit to the revenue account.
  // Its viewport is 900 high so the dialog stays under its 90vh ceiling and
  // the postings do not scroll. Then over the period as seeded, which
  // already has one: the refusal shows as the wizard opens.
  "budget-allocation-wizard": {
    level: "component",
    mount: "budget-allocation-wizard",
    capture: "viewport",
    width: 800,
    height: 900,
    mode: "light",
    periodId: "p1",
    deletedEntry: "tx5",
  },
  "budget-allocation-wizard-refused": {
    level: "component",
    mount: "budget-allocation-wizard",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    periodId: "p1",
  },
  // Account Details' ALLOCATION TABLES mini-grid for the building's
  // insurance in Pozzetto 2013 (`la173`): its one link, General at 100%,
  // at the width the grid has in the bottom panel.
  "account-allocation-tables": {
    level: "component",
    mount: "account-allocation-tables",
    width: 728,
    mode: "light",
    periodId: "p36",
    selectedKey: "la173",
  },

  // Saturno 2011's Installment Schedule panel alone, at the width it has at
  // the full layout: its two groups, A (Stairwell A) and B (Garages), each
  // over its units, the one place a golden shows the schedule's group rows.
  "installments-panel-saturno-groups": {
    level: "component",
    mount: "installment-schedule",
    width: 1000,
    mode: "light",
    periodId: "p1",
  },

  // Units, Owners & Personal Balance and Building Data & Suppliers. Saturno
  // 2011 (`p1`) has groups, A (`ug1`) and B (`ug2`), and A2 (`u2`) an owner
  // and a tenant; Pozzetto 2013 (`p36`) has no groups, and A04 (`u137`) two
  // owners one after the other (`r166`, `r167`).

  // Saturno's units under their groups, A2 (`u2`) selected, in view at the
  // top of the panel, its Unit Owners tab: the owner and the tenant under
  // their roles.
  "units-1280-light": {
    width: 1280,
    height: 720,
    mode: "light",
    periodId: "p1",
    menu: "units",
    unitKey: "unit:u2",
    unitTab: "Unit Owners",
  },
  // Every building over its periods, Pozzetto 2013 selected as the sidebar
  // holds it, its Building Profile under the grid.
  "building-data-1280-light": {
    width: 1280,
    height: 720,
    mode: "light",
    periodId: "p36",
    menu: "data",
  },
  // Pozzetto's Units panel alone, at the width it has at the full layout:
  // its units at the top level, A04 and A09 over their residents, the first
  // unit selected, and Rounding error last.
  "units-panel-pozzetto": {
    level: "component",
    mount: "units-panel",
    width: 1000,
    mode: "light",
    periodId: "p36",
  },
  // The Units screen's bottom panel, at the width it has at the full layout.
  // Pozzetto's A04 on Unit Owners: its two owners, each for their own days of
  // the year, and so each with a share of it.
  "unit-owners-ownership-change": {
    level: "section",
    mount: "unit-tabs",
    width: 1000,
    mode: "light",
    periodId: "p36",
    unitKey: "unit:u137",
    unitTab: "Unit Owners",
  },
  // Saturno's A1 on Unit Profile: a shop let for May 2011 only, its
  // restricted period, cadastral data and notes filled.
  "unit-profile-restricted": {
    level: "section",
    mount: "unit-tabs",
    width: 1000,
    mode: "light",
    periodId: "p1",
    unitKey: "unit:u1",
    unitTab: "Unit Profile",
  },
  // The Building Data screen's bottom panel, at the width it has at the full
  // layout. Saturno's Building Profile: its code, address, tax code and
  // construction date filled.
  "building-profile": {
    level: "section",
    mount: "building-tabs",
    width: 1000,
    mode: "light",
    periodId: "p1",
    buildingTab: "Building Profile",
  },
  // Pozzetto's suppliers, Acque Fella (`md85`) selected: its company data,
  // phone and email in the sheet beside the list.
  "building-suppliers": {
    level: "section",
    mount: "building-tabs",
    width: 1000,
    mode: "light",
    periodId: "p36",
    buildingTab: "Building Suppliers",
    supplierId: "md85",
  },
  // The New Group dialog at Saturno's top level (the period's row selected),
  // with the code of group A typed: the refusal, and + Add disabled.
  "group-dialog-taken": {
    level: "component",
    mount: "group-dialog",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    periodId: "p1",
    unitKey: "root",
    groupForm: { code: "A", name: "Stairwell C" },
  },
  // The New Unit dialog as it opens over Saturno, B1 selected: every field
  // blank, the required ones starred. Its viewport is 900 high so the dialog
  // stays under its 90vh ceiling and NOTES does not scroll out of view.
  "unit-dialog-new": {
    level: "component",
    mount: "unit-dialog",
    capture: "viewport",
    width: 800,
    height: 900,
    mode: "light",
    periodId: "p1",
    unitKey: "unit:u5",
  },
  // Edit Owner on Pozzetto's first owner of A04 (`r167`, until 18/01/2013):
  // the opening entry is posted, so the previous balance (2697.11, as the
  // field writes it) is the journal's, locked, with the line that says where
  // to change it.
  "owner-dialog-locked-balance": {
    level: "component",
    mount: "owner-dialog",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    periodId: "p36",
    residentId: "r167",
  },
  // Add Owner on Saturno's B3 (`u7`) ready to add: a contact linked, shown in
  // the picker's box, Tenant chosen and a balance typed. The period's opening
  // entry (`tx1`) is deleted so the previous balance can be typed.
  "owner-dialog-add": {
    level: "component",
    mount: "owner-dialog",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    periodId: "p1",
    deletedEntry: "tx1",
    unitKey: "unit:u7",
    ownerForm: { contactId: "md17", role: "CO", previousBalance: "-12.50" },
  },
  // Edit Building on Saturno as it opens: its profile in the fields, its
  // address as text after the tools.
  "building-dialog": {
    level: "component",
    mount: "building-dialog",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    periodId: "p1",
  },
  // Edit Management / Period on Saturno 2011, its start moved to June: A1 is
  // let for May only, so the dates are refused, naming it.
  "period-dialog-refused": {
    level: "component",
    mount: "period-dialog",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    periodId: "p1",
    periodForm: { start: "01/06/2011" },
  },
  // The Address dialog as Edit Building opens it on Saturno's address.
  "address-dialog": {
    level: "component",
    mount: "address-dialog",
    capture: "viewport",
    width: 800,
    height: 720,
    mode: "light",
    periodId: "p1",
  },

  // Sections: where the way parts sit together is what is pictured. The
  // Accounts screen's bottom panel, its tabs over the tab's body, each tab
  // over the account selected in Pozzetto 2013, at the width the panel has
  // at the full layout.

  // The cash account's ledger: its twelve postings, oldest first, with the
  // running balance, and the totals row under them.
  "accounts-bottom-panel-ledger": {
    level: "section",
    mount: "accounts-bottom-panel",
    width: 1000,
    mode: "light",
    periodId: "p36",
    selectedKey: "la154",
    bottomTab: "Ledger",
  },
  // A cost account's sheet (the building's insurance, `la173`): the cost
  // attributes it inherits, the table that allocates it, its balances and
  // its budget.
  "accounts-bottom-panel-cost-details": {
    level: "section",
    mount: "accounts-bottom-panel",
    width: 1000,
    mode: "light",
    periodId: "p36",
    selectedKey: "la173",
    bottomTab: "Account Details",
  },
};

/** A row of unit A01 as the settlement table shows it, partial when it pays less than the item owes. Its item id is only the row's key. */
function createSettlementRow(
  installment: string,
  dueDate: string,
  owed: number,
  paidNow: number,
): SettlementRow {
  return {
    itemId: `A01 ${installment}`,
    installment,
    unitCode: "A01",
    dueDate,
    owed: cents(owed),
    paidNow: cents(paidNow),
    partial: paidNow < owed,
  };
}
