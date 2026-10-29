import {
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useLayoutEffect,
} from "react";

import type { SettlementRow, WizardState } from "@cl/client-core";
import {
  type AllocationMode,
  cents,
  ok,
  type Result,
  rejected,
} from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { AmountLocaleProvider } from "#/ui/AmountLocaleProvider.tsx";
import { AccountDetails } from "#/ui/accounts/AccountDetails.tsx";
import { AccountIcon } from "#/ui/accounts/AccountIcon.tsx";
// The bottom panel's body is styled with the screen; alone, it needs the
// screen's stylesheet.
import "#/ui/accounts/AccountsScreen.css";
import { AllocationTablesGrid } from "#/ui/accounts/AllocationTablesGrid.tsx";
import { ACCOUNTS_COLUMNS } from "#/ui/accounts/columns.ts";
import { LedgerTab } from "#/ui/accounts/LedgerTab.tsx";
import { AllocationPanel } from "#/ui/allocation/AllocationPanel.tsx";
import { CoefficientsPanel } from "#/ui/allocation/CoefficientsPanel.tsx";
import {
  allocationColumnSpecs,
  COEFFICIENTS_COLUMN_SPECS,
  TABLES_COLUMN_SPECS,
} from "#/ui/allocation/columns.ts";
import { TableDialog } from "#/ui/allocation/TableDialog.tsx";
import { ThousandthTablesPanel } from "#/ui/allocation/ThousandthTablesPanel.tsx";
import { ConfirmAlert } from "#/ui/ConfirmAlert.tsx";
import { FormField } from "#/ui/FormField.tsx";
import { InlineEditor } from "#/ui/InlineEditor.tsx";
import { BudgetInstallmentsWizard } from "#/ui/installments/BudgetInstallmentsWizard.tsx";
import { InstallmentCell } from "#/ui/installments/InstallmentCell.tsx";
import { InstallmentDialog } from "#/ui/installments/InstallmentDialog.tsx";
import { EntryIcon } from "#/ui/journal/EntryIcon.tsx";
import { BudgetAllocationWizard } from "#/ui/journal/wizards/BudgetAllocationWizard.tsx";
import { CollectionWizard } from "#/ui/journal/wizards/CollectionWizard.tsx";
import { InvoiceWizard } from "#/ui/journal/wizards/InvoiceWizard.tsx";
import { MultiCostPaymentWizard } from "#/ui/journal/wizards/MultiCostPaymentWizard.tsx";
import { OpeningBalancesWizard } from "#/ui/journal/wizards/OpeningBalancesWizard.tsx";
import { reasonText } from "#/ui/journal/wizards/reasons.ts";
import { SettlementTable } from "#/ui/journal/wizards/SettlementTable.tsx";
import { WizardDialog } from "#/ui/journal/wizards/WizardDialog.tsx";
import { MenuItem } from "#/ui/MenuItem.tsx";
import { Money } from "#/ui/Money.tsx";
import { SegmentedControl } from "#/ui/SegmentedControl.tsx";
import { menuLabel } from "#/ui/shell/labels.tsx";
import { Placeholder } from "#/ui/shell/Placeholder.tsx";
import { Popover } from "#/ui/shell/Popover.tsx";
import { ToastHost } from "#/ui/shell/ToastHost.tsx";
import { TabbedPanel } from "#/ui/TabbedPanel.tsx";
import { TreeGrid, type TreeGridRowData } from "#/ui/TreeGrid.tsx";
import { TreeGridRow } from "#/ui/TreeGridRow.tsx";

import type { AccountRowPicture, CellPicture, Scenario } from "./scenarios.ts";

// What a scenario's `mount` names: the parts of the UI that are pictured on
// their own. This file is the project's. A new component gets an entry here,
// and its states get scenarios in `scenarios.ts`.
//
// An entry turns a scenario into an element. A leaf takes its props from the
// scenario. A part that reads the view model is given its state by the
// seeding, through the harness, as it is for the whole app.

/** Turns a scenario into the element it pictures. */
type Entry = (scenario: Scenario) => ReactElement;

const registry: Record<string, Entry> = {
  // The wizard reads its machine, which the seeding holds on the scenario's
  // step. Saving and cancelling close it on the Journal; alone, it stays.
  "collection-wizard": (): ReactElement => {
    return (
      <CollectionWizard
        editing={null}
        onSaved={ignoreClose}
        onCancel={ignoreClose}
      />
    );
  },
  "settlement-table": (scenario: Scenario): ReactElement => {
    return <SettlementTable rows={settlementOf(scenario)} />;
  },
  // The cells take only props: one under another, each a block as wide as
  // its column in the grid.
  "installment-cells": (scenario: Scenario): ReactElement => {
    return (
      <div>
        {cellsOf(scenario).map((cell, index) => {
          return (
            <InstallmentCell
              // biome-ignore lint/suspicious/noArrayIndexKey: a picture's cells never move; two may be alike
              key={index}
              label="Installment"
              amount={cell.amount === null ? null : cents(cell.amount)}
              status={cell.status}
              emphasis={false}
              editable={cell.editable}
              refusal={null}
              editing={false}
              error={null}
              onEdit={ignoreClose}
              onCommit={ignoreClose}
              onCancel={ignoreClose}
            />
          );
        })}
      </div>
    );
  },
  // The wizard reads its machine, which the seeding holds on the scenario's
  // step, over the period the sidebar holds.
  "budget-installments-wizard": (): ReactElement => {
    return (
      <BudgetInstallmentsWizard onSaved={ignoreClose} onCancel={ignoreClose} />
    );
  },
  // The dialog reads its machine, built over the scenario's installment.
  "installment-dialog": (scenario: Scenario): ReactElement => {
    return (
      <InstallmentDialog
        installmentId={installmentOf(scenario)}
        onSaved={ignoreClose}
        onCancel={ignoreClose}
      />
    );
  },
  money: (scenario: Scenario): ReactElement => {
    const money = required(scenario, "money", scenario.money);

    return (
      <Money
        cents={money.cents === null ? null : cents(money.cents)}
        variant={money.variant}
        emphasis={money.emphasis}
      />
    );
  },
  // The cells take only props: one under another, each as wide as the
  // picture.
  "money-column": (scenario: Scenario): ReactElement => {
    const moneys = required(scenario, "moneys", scenario.moneys);

    return (
      <div>
        {moneys.map((money, index) => {
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: a picture's cells never move; two may be alike
              key={index}
            >
              <Money
                cents={money.cents === null ? null : cents(money.cents)}
                variant={money.variant}
                emphasis={money.emphasis}
              />
            </div>
          );
        })}
      </div>
    );
  },
  // A row alone under the grid's template, which the grid writes as a CSS
  // variable on its own element: here the wrapper carries it.
  "tree-grid-row": (scenario: Scenario): ReactElement => {
    const [row] = required(scenario, "accountRows", scenario.accountRows);

    if (row === undefined) {
      throw new Error(
        'A "tree-grid-row" mount shows the first of the scenario\'s `accountRows`, and this one has none.',
      );
    }

    return (
      <div className="tree-grid" style={ROW_TEMPLATE}>
        <TreeGridRow
          row={accountRowOf(row)}
          columns={ROW_COLUMNS}
          onToggle={ignoreClose}
          onSelect={ignoreClose}
        />
      </div>
    );
  },
  "tree-grid": (scenario: Scenario): ReactElement => {
    return (
      <TreeGrid
        columns={ROW_COLUMNS}
        template={TEMPLATE}
        rows={required(scenario, "accountRows", scenario.accountRows).map(
          accountRowOf,
        )}
        emptyMessage="No account matches."
        onToggle={ignoreClose}
        onSelect={ignoreClose}
        onResize={ignoreClose}
      />
    );
  },
  "inline-editor": (scenario: Scenario): ReactElement => {
    const editor = required(scenario, "editor", scenario.editor);

    return (
      <InlineEditor
        label="Budget"
        value={editor.value}
        error={editor.error}
        onCommit={ignoreClose}
        onCancel={ignoreClose}
      />
    );
  },
  "segmented-control": (scenario: Scenario): ReactElement => {
    const segments = required(scenario, "segments", scenario.segments);

    return (
      <SegmentedControl
        label={segments.label}
        options={segments.options}
        value={segments.value}
        onChange={ignoreClose}
      />
    );
  },
  "confirm-alert": (scenario: Scenario): ReactElement => {
    const confirm = required(scenario, "confirm", scenario.confirm);

    return (
      <ConfirmAlert
        text={confirm.text}
        error={confirm.error}
        onYes={ignoreClose}
        onNo={ignoreClose}
      />
    );
  },
  // Any wizard's dialog from its props, over a body of one field. The
  // picture is of a draft already edited when it shows a reason.
  "wizard-dialog": (scenario: Scenario): ReactElement => {
    const picture = required(scenario, "wizardDialog", scenario.wizardDialog);

    return (
      <WizardDialog
        name={picture.name}
        stepTitle={picture.stepTitle}
        context={PICTURED_CONTEXT}
        state={wizardStateOf(picture)}
        refusal={null}
        reasonText={wordForEveryWizard}
        writesEntry={picture.writesEntry}
        onNext={ignoreClose}
        onBack={ignoreClose}
        onSave={ignoreClose}
        onCancel={ignoreClose}
      >
        <FormField label="Description">
          <input className="wizard-input" defaultValue={picture.description} />
        </FormField>
      </WizardDialog>
    );
  },
  // The wizards read their machines, which the seeding fills from the
  // scenario, over the period the sidebar holds.
  "multi-cost-payment-wizard": (): ReactElement => {
    return (
      <MultiCostPaymentWizard
        editing={null}
        onSaved={ignoreClose}
        onCancel={ignoreClose}
      />
    );
  },
  "invoice-wizard": (): ReactElement => {
    return (
      <InvoiceWizard
        editing={null}
        onSaved={ignoreClose}
        onCancel={ignoreClose}
      />
    );
  },
  "opening-balances-wizard": (): ReactElement => {
    return (
      <OpeningBalancesWizard
        editing={null}
        onSaved={ignoreClose}
        onCancel={ignoreClose}
      />
    );
  },
  // A screen not built yet, in a box the height of a short main area: the
  // placeholder fills the main area it is given.
  placeholder: (): ReactElement => {
    return (
      <div style={PLACEHOLDER_BOX}>
        <Placeholder title={menuLabel("units")} />
      </div>
    );
  },
  // The menu hangs from the box its button sits in, 34 pixels under the
  // box's top and flush with its right edge; the box is the picture's width
  // less a margin for the menu's shadow.
  popover: (scenario: Scenario): ReactElement => {
    const popover = required(scenario, "popover", scenario.popover);

    return (
      <div style={POPOVER_BOX}>
        <Popover open label={popover.label} width="wide" onClose={ignoreClose}>
          {popover.items.map((item) => {
            return (
              <MenuItem
                key={item.label}
                label={item.label}
                icon={<EntryIcon kind={item.kind} />}
                onClick={ignoreClose}
              />
            );
          })}
        </Popover>
      </div>
    );
  },
  // The notices are the app's, which the seeding stubs from the scenario.
  "toast-host": (): ReactElement => {
    return <ToastHost />;
  },
  // The Accounts screen's bottom panel as `AccountsScreen` draws it: its
  // tabs over the body of the scenario's tab, which reads the account the
  // seeding selects in the period the sidebar holds. The active tab is the
  // screen's machine there; here it is the scenario's.
  "accounts-bottom-panel": (scenario: Scenario): ReactElement => {
    const active = required(scenario, "bottomTab", scenario.bottomTab);

    return (
      <TabbedPanel
        label="Selected account"
        tabs={BOTTOM_TABS}
        active={active}
        onActivate={ignoreClose}
      >
        <div className="accounts-tab-body">
          {active === "Ledger" ? <LedgerTab /> : <AccountDetails />}
        </div>
      </TabbedPanel>
    );
  },
  // The Thousandth Tables & Allocation screen's panels, each read from the
  // view model as the screen reads it, over the period the sidebar holds:
  // the screen's table selection and allocation mode, which the seeding
  // sets through their own intents.
  "thousandth-tables-panel": (): ReactElement => {
    return <TablesPanelPart />;
  },
  "coefficients-panel": (): ReactElement => {
    return <CoefficientsPanelPart />;
  },
  "allocation-panel": (): ReactElement => {
    return <AllocationPanelPart />;
  },
  // The New Thousandth Table dialog reads its machine, which the seeding
  // fills from the scenario, over the period's tables.
  "table-dialog": (): ReactElement => {
    return (
      <TableDialog
        editing={null}
        onSaved={ignoreClose}
        onCancel={ignoreClose}
      />
    );
  },
  // The wizard reads its machine over the period's books as they stand.
  "budget-allocation-wizard": (): ReactElement => {
    return (
      <BudgetAllocationWizard onSaved={ignoreClose} onCancel={ignoreClose} />
    );
  },
  // Account Details' tables mini-grid, over the account the seeding selects.
  "account-allocation-tables": (): ReactElement => {
    return <AccountTablesPart />;
  },
};

/** The Thousandth Tables panel as the screen hands it its props. */
function TablesPanelPart(): ReactElement {
  const { useAllocation, useColumns } = useViewModel();
  const { tables, selectedTableId } = useAllocation();
  const columns = useColumns("tables", TABLES_COLUMN_SPECS);

  return (
    <ThousandthTablesPanel
      tables={tables}
      selectedTableId={selectedTableId}
      template={columns.state.template}
      onSelect={ignoreClose}
      onResize={ignoreClose}
      onAdd={ignoreClose}
      onEdit={ignoreClose}
      onDelete={ignoreClose}
      onStub={ignoreClose}
    />
  );
}

/** The Table Coefficients panel as the screen hands it its props: the selected table's tree. */
function CoefficientsPanelPart(): ReactElement {
  const { useCoefficientsGrid, useColumns } = useViewModel();
  const grid = useCoefficientsGrid();
  const columns = useColumns("coefficients", COEFFICIENTS_COLUMN_SPECS);

  return (
    <CoefficientsPanel
      rows={grid.state.rows}
      template={columns.state.template}
      onToggle={ignoreClose}
      onExpandAll={ignoreClose}
      onCollapseAll={ignoreClose}
      onResize={ignoreClose}
      onSetCoefficient={writeNothing}
      onStub={ignoreClose}
    />
  );
}

/** The Allocation panel as the screen hands it its props, its column widths built for its count of accounts. */
function AllocationPanelPart(): ReactElement {
  const { useAllocation } = useViewModel();
  const { allocation, mode } = useAllocation();
  const columns =
    allocation?.columns.map((column) => {
      return column.label;
    }) ?? [];

  return <AllocationColumns columns={columns} mode={mode} />;
}

interface AllocationColumnsProps {
  columns: string[];
  mode: AllocationMode;
}

/** The Allocation with the column widths kept for its count of accounts. */
function AllocationColumns({
  columns,
  mode,
}: AllocationColumnsProps): ReactElement {
  const { useAllocationGrid, useColumns } = useViewModel();
  const grid = useAllocationGrid();
  const widths = useColumns(
    "allocation",
    allocationColumnSpecs(columns.length),
  );

  return (
    <AllocationPanel
      columns={columns}
      rows={grid.state.rows}
      mode={mode}
      template={widths.state.template}
      maximized={false}
      onChooseMode={ignoreClose}
      onToggle={ignoreClose}
      onExpandAll={ignoreClose}
      onCollapseAll={ignoreClose}
      onResize={ignoreClose}
      onToggleMaximize={ignoreClose}
      onStub={ignoreClose}
    />
  );
}

/** The selected account's tables mini-grid, as Account Details hands it its rows, on the sheet's surface. */
function AccountTablesPart(): ReactElement {
  const { useAccountDetails } = useViewModel();
  const details = useAccountDetails();

  return (
    <div style={PANEL_SURFACE}>
      <AllocationTablesGrid rows={details?.allocationTables.rows ?? []} />
    </div>
  );
}

/** The bottom panel's tabs, in `AccountsScreen`'s order. */
const BOTTOM_TABS = ["Account Details", "Ledger"] as const;

/** The chart of accounts' first four columns: the tree, Debit, Credit and Balance. */
const ROW_COLUMNS = ACCOUNTS_COLUMNS.slice(0, 4);

/** Their widths as the columns machine starts them (`ACCOUNTS_COLUMN_SPECS`): 700 in all. */
const TEMPLATE = "400px 100px 100px 100px";

const ROW_TEMPLATE = { "--tree-grid-template": TEMPLATE } as CSSProperties;

const POPOVER_BOX: CSSProperties = { position: "relative", margin: "0 12px" };

/** The surface of the panel a part sits on in the app: Account Details' sheet, under the mini-grid's rows and border. */
const PANEL_SURFACE: CSSProperties = { background: "var(--panel)" };

const PLACEHOLDER_BOX: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: 240,
};

/** The building and period the wizard dialog's props name. */
const PICTURED_CONTEXT = { building: "Pozzetto", period: "2013" };

interface SurroundProps {
  children: ReactNode;
}

/**
 * What the app puts around everything it draws, without its layout: the
 * theme and the mode `ui/shell/AppRoot.tsx` sets on its root, where the
 * tokens read them, and the amount locale it hands down. The mode and the
 * language are the session's preferences, which the seeding sets from the
 * scenario.
 *
 * The app's root also draws the page under the parts: its background, the
 * text's colour and font, and the mode's `color-scheme`, which the native
 * controls follow. Alone, a part sits on the body, which draws the same
 * from the same tokens. So the attributes go on the document's root as well
 * as around the part: the body, the padding of a root capture and the
 * viewport of a dialog then take the scenario's mode, not the default's.
 */
function Surround({ children }: SurroundProps): ReactElement {
  const { useSession } = useViewModel();
  const { preferences } = useSession();
  const { theme, mode } = preferences;

  useLayoutEffect(() => {
    const page = document.documentElement;

    page.dataset.theme = theme;
    page.dataset.mode = mode;
    page.style.colorScheme = mode;
  }, [theme, mode]);

  return (
    <div data-theme={theme} data-mode={mode}>
      <AmountLocaleProvider>{children}</AmountLocaleProvider>
    </div>
  );
}

interface MountProps {
  scenario: Scenario;
}

/** The entry a scenario's `mount` names, in the app's surround. */
export function Mount({ scenario }: MountProps): ReactElement {
  const key = scenario.mount ?? "";
  const entry: Entry | undefined = registry[key];

  if (entry === undefined) {
    throw new Error(
      `No entry "${key}" in registry.tsx. Its entries: ${Object.keys(registry).join(", ")}`,
    );
  }

  return <Surround>{entry(scenario)}</Surround>;
}

/** A row as `AccountsGrid` makes it from a node: a row with children has a bold label, and a row at an even place is on a stripe. */
function accountRowOf(row: AccountRowPicture): TreeGridRowData {
  return {
    key: row.key,
    depth: row.depth,
    hasChildren: row.hasChildren,
    expanded: row.expanded,
    selected: row.selected,
    emphasis: row.hasChildren,
    zebra: row.position % 2 === 0,
    icon: (
      <AccountIcon
        icon={row.icon}
        nature={row.nature}
        open={row.expanded}
        root={row.root}
      />
    ),
    label: row.label,
    cells: [
      <Money key="debit" cents={cents(row.debit)} variant="plain" />,
      <Money key="credit" cents={cents(row.credit)} variant="plain" />,
      <Money key="balance" cents={cents(row.balance)} />,
    ],
  };
}

/** The state a wizard's machine would hold on the picture's step: its reason refuses the step's Next, or Save on the last. */
function wizardStateOf(
  picture: NonNullable<Scenario["wizardDialog"]>,
): WizardState<unknown, unknown> {
  const last = picture.step === picture.stepCount;
  const judged: Result =
    picture.reason === null ? ok() : rejected(picture.reason);

  return {
    step: picture.step,
    firstStep: 1,
    stepCount: picture.stepCount,
    form: null,
    choices: [],
    preview: picture.preview.map((line) => {
      return {
        path: line.path,
        debit: cents(line.debit),
        credit: cents(line.credit),
      };
    }),
    verdict: last ? judged : ok(),
    stepVerdict: last ? ok() : judged,
    summary: null,
    touched: picture.reason !== null,
    saving: false,
    editing: picture.editing ? "edited" : null,
  };
}

/** A field of the scenario that its mount shows, or the error that names both. */
function required<T>(
  scenario: Scenario,
  field: keyof Scenario,
  value: T | undefined,
): T {
  if (value === undefined) {
    throw new Error(
      `A "${scenario.mount ?? ""}" mount shows the scenario's \`${field}\`, and this one has none.`,
    );
  }

  return value;
}

function settlementOf(scenario: Scenario): SettlementRow[] {
  if (scenario.settlement === undefined) {
    throw new Error(
      'A "settlement-table" mount shows the scenario\'s `settlement`, and this one has none.',
    );
  }

  return scenario.settlement;
}

function cellsOf(scenario: Scenario): CellPicture[] {
  if (scenario.cells === undefined) {
    throw new Error(
      'An "installment-cells" mount shows the scenario\'s `cells`, and this one has none.',
    );
  }

  return scenario.cells;
}

function installmentOf(scenario: Scenario): string {
  if (scenario.installmentId === undefined) {
    throw new Error(
      'An "installment-dialog" mount opens on the scenario\'s `installmentId`, and this one has none.',
    );
  }

  return scenario.installmentId;
}

/** A reason in the words every wizard shares. */
function wordForEveryWizard(reason: string): string {
  return reasonText(reason);
}

/** A picture is never typed in: no coefficient is written. */
function writeNothing(): Promise<Result> {
  return Promise.resolve(ok());
}

/** A picture is never clicked. */
function ignoreClose(): void {
  // Nothing to do.
}
