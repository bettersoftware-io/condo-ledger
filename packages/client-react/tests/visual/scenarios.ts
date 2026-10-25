import type {
  DirectPaymentKind,
  GenericLine,
  InvoiceForm,
  OpeningAmount,
  SettlementRow,
} from "@cl/client-core";
import { type CellStatus, cents } from "@cl/domain";

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
  menu?: "accounts" | "journal" | "installments";
  /** The seed the app runs on: the generated one when absent; `schedule`, the test seed whose 2015 (`p3`) has books and no installments. */
  seed?: "schedule";
  /** The journal entries open, by id. */
  expandedEntries?: string[];
  /** The journal entry selected, by id, on the page that holds it. */
  selectedEntry?: string;
  /** A dialog open over the Journal, with what is typed in it. */
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
}

/** The budget wizard on step 2: the first due date typed on step 1, the other fields as they open. */
interface BudgetInstallmentsStep {
  step: 2;
  firstDue: string;
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
 * a period with no schedule, and the Edit Installment dialog.
 */
export const scenarios: Record<string, Scenario> = {
  "accounts-1280-light": {
    width: 1280,
    height: 720,
    mode: "light",
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
        "Cassa contanti per le piccole spese della gestione ordinaria, straordinaria e del riscaldamento, con il riporto dei saldi dell'esercizio precedente",
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
      description: "Nota di credito",
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
  // question whether to delete it.
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
  // Step 2 for the owner of A01 (`md89`, who owes Rata 9 to Rata 12, 134.98
  // each), 300.00 typed: Rata 9 and Rata 10 are settled, Rata 11 in part.
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
      createSettlementRow("Rata 9", "2013-09-20", 13498, 13498),
      createSettlementRow("Rata 10", "2013-10-20", 13498, 13498),
      createSettlementRow("Rata 11", "2013-11-20", 13498, 3004),
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
  // Saturno 2011's first installment (`in1`, Rata nr. 1), locked: its name
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
