import {
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useLayoutEffect,
} from "react";

import type {
  DeadlineNames,
  SettlementRow,
  WizardState,
} from "@cl/client-core";
import {
  ALL_CONTACTS,
  type AllocationMode,
  type ContactFilter,
  cents,
  type Deadline,
  manual,
  ok,
  type Result,
  rejected,
} from "@cl/domain";
import { useViewModel } from "@cl/react-bindings";

import { AddressDialog } from "#/ui/AddressDialog.tsx";
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
import { BuildingDialog } from "#/ui/buildingData/BuildingDialog.tsx";
import { BuildingTabs } from "#/ui/buildingData/BuildingTabs.tsx";
import { SUPPLIERS_COLUMN_SPECS } from "#/ui/buildingData/columns.ts";
import { BUILDING_TABS } from "#/ui/buildingData/labels.ts";
import { PeriodDialog } from "#/ui/buildingData/PeriodDialog.tsx";
import { SupplierDialog } from "#/ui/buildingData/SupplierDialog.tsx";
import { ConfirmAlert } from "#/ui/ConfirmAlert.tsx";
import { CalendarsMenu } from "#/ui/calendar/CalendarsMenu.tsx";
import { DayCell } from "#/ui/calendar/DayCell.tsx";
import { DayList } from "#/ui/calendar/DayList.tsx";
import { DeadlineDetails } from "#/ui/calendar/DeadlineDetails.tsx";
import { DeadlineDialog } from "#/ui/calendar/DeadlineDialog.tsx";
import { DeadlinesColumn } from "#/ui/calendar/DeadlinesColumn.tsx";
import { CategoryDialog } from "#/ui/contacts/CategoryDialog.tsx";
import { ConnectionDialog } from "#/ui/contacts/ConnectionDialog.tsx";
import { ContactCategories } from "#/ui/contacts/ContactCategories.tsx";
import { ContactDialog } from "#/ui/contacts/ContactDialog.tsx";
import { ContactFilters } from "#/ui/contacts/ContactFilters.tsx";
import { ContactPicker } from "#/ui/contacts/ContactPicker.tsx";
import { ContactRowDialog } from "#/ui/contacts/ContactRowDialog.tsx";
import { ContactsPanel } from "#/ui/contacts/ContactsPanel.tsx";
import { ContactTabs } from "#/ui/contacts/ContactTabs.tsx";
import {
  CONNECTIONS_COLUMN_SPECS,
  CONTACTS_COLUMN_SPECS,
} from "#/ui/contacts/columns.ts";
import { CONTACT_TABS } from "#/ui/contacts/labels.ts";
import { FormField } from "#/ui/FormField.tsx";
import { InlineEditor } from "#/ui/InlineEditor.tsx";
import { BudgetInstallmentsWizard } from "#/ui/installments/BudgetInstallmentsWizard.tsx";
import { InstallmentCell } from "#/ui/installments/InstallmentCell.tsx";
import { InstallmentDialog } from "#/ui/installments/InstallmentDialog.tsx";
import { InstallmentScheduleScreen } from "#/ui/installments/InstallmentScheduleScreen.tsx";
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
import { Popover } from "#/ui/shell/Popover.tsx";
import { ToastHost } from "#/ui/shell/ToastHost.tsx";
import { TabbedPanel } from "#/ui/TabbedPanel.tsx";
import { TreeGrid, type TreeGridRowData } from "#/ui/TreeGrid.tsx";
import { TreeGridRow } from "#/ui/TreeGridRow.tsx";
import {
  UNIT_OWNERS_COLUMN_SPECS,
  UNITS_COLUMN_SPECS,
} from "#/ui/units/columns.ts";
import { GroupDialog } from "#/ui/units/GroupDialog.tsx";
import { UNIT_TABS } from "#/ui/units/labels.ts";
import { OwnerDialog } from "#/ui/units/OwnerDialog.tsx";
import { UnitDialog } from "#/ui/units/UnitDialog.tsx";
import { UnitsPanel } from "#/ui/units/UnitsPanel.tsx";
import { UnitTabs } from "#/ui/units/UnitTabs.tsx";

import type {
  AccountRowPicture,
  CellPicture,
  DayCellPicture,
  DeadlinePicture,
  Scenario,
} from "./scenarios.ts";

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
  // The Installment Schedule's one panel, as the screen draws it, over the
  // period the sidebar holds; the shell's maximize machine is the app's.
  "installment-schedule": (): ReactElement => {
    return <SchedulePart />;
  },
  // The Units screen's panels, each read from the view model as the screen
  // reads it, over the period the sidebar holds: the row the seeding selects
  // and the tab it chooses, through their own intents.
  "units-panel": (): ReactElement => {
    return <UnitsPanelPart />;
  },
  "unit-tabs": (): ReactElement => {
    return <UnitTabsPart />;
  },
  // The Building Data screen's bottom panel, over the selected period's
  // building, on the tab and the supplier the seeding chooses.
  "building-tabs": (): ReactElement => {
    return <BuildingTabsPart />;
  },
  // The Units screen's dialogs read their machines, which the seeding fills
  // from the scenario, over the row it selects.
  "group-dialog": (): ReactElement => {
    return (
      <GroupDialog
        editing={null}
        onSaved={ignoreClose}
        onCancel={ignoreClose}
      />
    );
  },
  "unit-dialog": (): ReactElement => {
    return <UnitDialogPart />;
  },
  "owner-dialog": (scenario: Scenario): ReactElement => {
    return <OwnerDialogPart editing={scenario.residentId ?? null} />;
  },
  // The Building Data screen's dialogs, on the selected period's building
  // and on the period itself.
  "building-dialog": (): ReactElement => {
    return <BuildingDialogPart />;
  },
  "period-dialog": (scenario: Scenario): ReactElement => {
    return (
      <PeriodDialog
        periodId={required(scenario, "periodId", scenario.periodId)}
        onSaved={ignoreClose}
        onCancel={ignoreClose}
      />
    );
  },
  "address-dialog": (): ReactElement => {
    return <AddressDialogPart />;
  },
  // The Contacts screen's sidebar cards, its list and its bottom panel, each
  // read from the view model as the screen reads it: the contact the seeding
  // selects, the filter it applies and the tab it chooses, through their own
  // intents.
  "contact-filters": (): ReactElement => {
    return <ContactFiltersPart />;
  },
  "contact-categories": (): ReactElement => {
    return <ContactCategoriesPart />;
  },
  "contacts-panel": (): ReactElement => {
    return <ContactsPanelPart />;
  },
  "contact-tabs": (): ReactElement => {
    return <ContactTabsPart />;
  },
  // The Contacts dialogs read their machines, which the seeding fills from
  // the scenario.
  "contact-dialog": (scenario: Scenario): ReactElement => {
    return <ContactDialogPart scenario={scenario} />;
  },
  "contact-row-dialog": (): ReactElement => {
    return (
      <ContactRowDialog
        row={null}
        nextOrder={2}
        onApply={ignoreClose}
        onClose={ignoreClose}
      />
    );
  },
  "category-dialog": (): ReactElement => {
    return (
      <CategoryDialog
        editing={null}
        onAdded={ignoreClose}
        onSaved={ignoreClose}
        onCancel={ignoreClose}
      />
    );
  },
  "connection-dialog": (scenario: Scenario): ReactElement => {
    return (
      <ConnectionDialog
        contactId={required(scenario, "contactId", scenario.contactId)}
        editing={null}
        onSaved={ignoreClose}
        onCancel={ignoreClose}
      />
    );
  },
  "supplier-dialog": (): ReactElement => {
    return <SupplierDialogPart />;
  },
  // The picker alone, on the contacts the app holds, with the contact the
  // scenario links.
  "contact-picker": (scenario: Scenario): ReactElement => {
    return <ContactPickerPart contactId={scenario.contactId ?? null} />;
  },
  // Day cells side by side, from their props, as a week of the month lays
  // them out: the scenario's today ringed, a cell's place its weekday.
  "day-cells": (scenario: Scenario): ReactElement => {
    const cells = required(scenario, "dayCells", scenario.dayCells);
    const today = required(scenario, "today", scenario.today);

    return (
      <div className="month-week" style={dayRow(cells.length)}>
        {cells.map((cell, index) => {
          return (
            <DayCell
              // biome-ignore lint/suspicious/noArrayIndexKey: a picture's cells never move; two blank ones may be alike
              key={index}
              day={cell.day}
              weekday={index}
              deadlines={deadlinesOf(cell)}
              today={today}
              selected={cell.selected ?? false}
              selectedId={cell.selectedId ?? null}
              names={NAMES_UNUSED}
              onSelectDay={ignoreClose}
              onSelectDeadline={ignoreClose}
            />
          );
        })}
      </div>
    );
  },
  // The Calendars menu, open, from its props: it hangs 31 pixels under the
  // box its button sits in, flush with the box's left edge, over a fixed
  // scrim, so it is pictured as a dialog is, in a viewport of its own size.
  "calendars-menu": (scenario: Scenario): ReactElement => {
    return (
      <div className="calendars-filter" style={MENU_BOX}>
        <CalendarsMenu
          open
          hidden={new Set(scenario.hiddenCalendars ?? [])}
          onToggle={ignoreClose}
          onAll={ignoreClose}
          onNone={ignoreClose}
          onClose={ignoreClose}
        />
      </div>
    );
  },
  // The deadlines column's two panels' bodies, each read from the Calendar
  // as the column reads it: the day and the deadline the seeding selects,
  // judged against the scenario's today.
  "day-list": (): ReactElement => {
    return <DayListPart />;
  },
  "deadline-details": (): ReactElement => {
    return <DeadlineDetailsPart />;
  },
  // The whole column as the shell mounts it beside the month, in a box of
  // the height it has on the page at the full layout.
  "deadlines-column": (): ReactElement => {
    return (
      <div style={COLUMN_BOX}>
        <DeadlinesColumn maximized={false} onRestore={ignoreClose} />
      </div>
    );
  },
  // Add Deadline on the scenario's day, on Pozzetto as the Building filter
  // would hand it, or Edit Deadline on the typed deadline the seeding
  // selects; the seeding types the scenario's fields.
  "deadline-dialog": (scenario: Scenario): ReactElement => {
    return <DeadlineDialogPart scenario={scenario} />;
  },
};

interface DeadlineDialogPartProps {
  scenario: Scenario;
}

/** The dialog as the column opens it: Add on the day, or Edit on the selected typed deadline once the Calendar has answered. */
function DeadlineDialogPart({
  scenario,
}: DeadlineDialogPartProps): ReactElement | null {
  const { useCalendar } = useViewModel();
  const view = useCalendar();
  const day = required(scenario, "calendarDay", scenario.calendarDay);

  if (scenario.deadlineId === undefined) {
    return (
      <DeadlineDialog
        spec={{ mode: "add", day, buildingId: "c19" }}
        onSaved={ignoreClose}
        onCancel={ignoreClose}
      />
    );
  }

  const selected = view?.selected ?? null;

  if (selected === null) {
    return null;
  }

  if (selected.source !== "manual") {
    throw new Error(
      `Edit Deadline opens on a typed deadline, and ${selected.id} is worked out from the books`,
    );
  }

  return (
    <DeadlineDialog
      spec={{ mode: "edit", deadline: selected }}
      onSaved={ignoreClose}
      onCancel={ignoreClose}
    />
  );
}

/** The selected day's deadlines as the column hands them to the list; nothing until the Calendar has answered. */
function DayListPart(): ReactElement | null {
  const { useCalendar } = useViewModel();
  const view = useCalendar();

  return view === null ? null : (
    <div style={PANEL_SURFACE}>
      <DayList
        deadlines={view.dayDeadlines}
        selectedId={view.selected?.id ?? null}
        today={view.today}
        names={view.names}
        onSelect={ignoreClose}
      />
    </div>
  );
}

/** The selected deadline as the column hands it to the details; nothing until the Calendar has answered. */
function DeadlineDetailsPart(): ReactElement | null {
  const { useCalendar } = useViewModel();
  const view = useCalendar();

  return view === null ? null : (
    <div style={PANEL_SURFACE}>
      <DeadlineDetails
        deadline={view.selected}
        today={view.today}
        names={view.names}
      />
    </div>
  );
}

/** Filter Contacts as the sidebar hands it its props. */
function ContactFiltersPart(): ReactElement {
  const { useContactsScreen, useBuildingsTree } = useViewModel();
  const { view, typeKeyword, search, setFilter, reset } = useContactsScreen();
  const buildings = useBuildingsTree();

  function setBuilding(buildingId: string | null): void {
    setFilter({ buildingId });
  }

  function setStatus(status: ContactFilter["status"]): void {
    setFilter({ status });
  }

  function setPersons(persons: boolean): void {
    setFilter({ persons });
  }

  function setCompanies(companies: boolean): void {
    setFilter({ companies });
  }

  return (
    <ContactFilters
      filter={view?.filter ?? ALL_CONTACTS}
      typedKeyword={view?.typedKeyword ?? ""}
      buildings={buildings}
      onPersons={setPersons}
      onCompanies={setCompanies}
      onKeyword={typeKeyword}
      onSearch={search}
      onBuilding={setBuilding}
      onStatus={setStatus}
      onReset={reset}
    />
  );
}

/** Contact Categories as the sidebar hands it its props. */
function ContactCategoriesPart(): ReactElement {
  const { useContactsScreen } = useViewModel();
  const { view } = useContactsScreen();

  return (
    <ContactCategories
      categories={view?.categories ?? []}
      allCount={view?.allCount ?? 0}
      selectedId={view?.filter.categoryId ?? null}
      onSelect={ignoreClose}
      onAdd={ignoreClose}
      onEdit={ignoreClose}
      onDelete={ignoreClose}
      onStub={ignoreClose}
    />
  );
}

/** The Contact List as the Contacts screen hands it its props. */
function ContactsPanelPart(): ReactElement {
  const { useContactsScreen, useColumns } = useViewModel();
  const { view } = useContactsScreen();
  const columns = useColumns("contacts", CONTACTS_COLUMN_SPECS);

  return (
    <ContactsPanel
      contacts={view?.rows ?? []}
      selectedId={view?.selected?.id ?? null}
      page={view?.page ?? 1}
      pageCount={view?.pageCount ?? 1}
      pageSize={view?.pageSize ?? 10}
      total={view?.total ?? 0}
      template={columns.state.template}
      maximized={false}
      onSelect={ignoreClose}
      onPage={ignoreClose}
      onPageSize={ignoreClose}
      onResize={ignoreClose}
      onToggleMaximize={ignoreClose}
      onStub={ignoreClose}
    />
  );
}

/** The Contacts screen's bottom panel as the screen hands it its props. */
function ContactTabsPart(): ReactElement {
  const { useContactsScreen, useColumns, useBottomTab } = useViewModel();
  const { view } = useContactsScreen();
  const connectionsColumns = useColumns(
    "connections",
    CONNECTIONS_COLUMN_SPECS,
  );
  const tabs = useBottomTab("contacts", CONTACT_TABS);

  return (
    <ContactTabs
      active={tabs.state.active}
      contact={view?.selected ?? null}
      uses={view?.uses ?? null}
      connections={view?.connections ?? []}
      selectedConnectionId={view?.selectedConnection?.connection.id ?? null}
      connectionsTemplate={connectionsColumns.state.template}
      onActivate={ignoreClose}
      onNewContact={ignoreClose}
      onEditContact={ignoreClose}
      onDeleteContact={ignoreClose}
      onSelectConnection={ignoreClose}
      onAddConnection={ignoreClose}
      onEditConnection={ignoreClose}
      onDeleteConnection={ignoreClose}
      onResizeConnections={ignoreClose}
      onStub={ignoreClose}
    />
  );
}

interface ContactDialogPartProps {
  scenario: Scenario;
}

/** The New or Edit Person or Company dialog, on the contact the scenario names; nothing until the contacts are there. */
function ContactDialogPart({
  scenario,
}: ContactDialogPartProps): ReactElement | null {
  const { useContacts } = useViewModel();
  const contacts = useContacts();
  const wanted = required(scenario, "contactDialog", scenario.contactDialog);

  if ("edit" in wanted) {
    const editing = contacts.find((view) => {
      return view.id === wanted.edit;
    });

    return editing === undefined ? null : (
      <ContactDialog
        spec={{ kind: editing.kind, editing: editing.contact }}
        onAdded={ignoreClose}
        onSaved={ignoreClose}
        onCancel={ignoreClose}
      />
    );
  }

  return (
    <ContactDialog
      spec={{ kind: wanted.kind, editing: null }}
      onAdded={ignoreClose}
      onSaved={ignoreClose}
      onCancel={ignoreClose}
    />
  );
}

/** Add Supplier on the building of the selected period; nothing until there is one. */
function SupplierDialogPart(): ReactElement | null {
  const { useBuildingData } = useViewModel();
  const { building } = useBuildingData().view;

  return building === null ? null : (
    <SupplierDialog
      buildingId={building.id}
      onSaved={ignoreClose}
      onCancel={ignoreClose}
    />
  );
}

interface ContactPickerPartProps {
  contactId: string | null;
}

/** The picker over the contacts the app holds, with its New, Edit and Clear buttons. */
function ContactPickerPart({
  contactId,
}: ContactPickerPartProps): ReactElement {
  const { useContacts } = useViewModel();
  const contacts = useContacts();

  // The picker is laid out by the label column of the dialog it is in: the
  // owner's, as Add Owner and Add Supplier have it.
  return (
    <div className="form-dialog" data-labels="owner">
      <ContactPicker
        contacts={contacts}
        value={contactId}
        fixed={false}
        creating
        onChange={ignoreClose}
        onNew={ignoreClose}
        onEdit={ignoreClose}
      />
    </div>
  );
}

/** The Installment Schedule screen alone, with the shell's maximize machine. */
function SchedulePart(): ReactElement {
  const { useMaximize } = useViewModel();
  const maximize = useMaximize();

  return <InstallmentScheduleScreen maximize={maximize} />;
}

/** The Units panel as the Units screen hands it its props: ✎ on a unit, a resident or a group, − on a unit, a resident or an empty group. */
function UnitsPanelPart(): ReactElement {
  const { useUnits, useUnitsGrid, useColumns } = useViewModel();
  const { view } = useUnits();
  const grid = useUnitsGrid();
  const columns = useColumns("units", UNITS_COLUMN_SPECS);

  return (
    <UnitsPanel
      rows={grid.state.rows}
      selectedKey={view?.selected?.key ?? null}
      unitCount={view?.list.unitCount ?? null}
      template={columns.state.template}
      maximized={false}
      onSelect={ignoreClose}
      onToggle={ignoreClose}
      onExpandAll={ignoreClose}
      onCollapseAll={ignoreClose}
      onResize={ignoreClose}
      onToggleMaximize={ignoreClose}
      canAdd={view !== null}
      canAddOwner={view?.unit != null}
      canEdit={view?.unit != null || view?.group != null}
      canDelete={
        view?.unit != null ||
        (view?.group != null && view.selected?.children.length === 0)
      }
      onAdd={ignoreClose}
      onEdit={ignoreClose}
      onDelete={ignoreClose}
      onStub={ignoreClose}
    />
  );
}

/** The Units screen's bottom panel as the screen hands it its props: ✎ and − on the selected owner on Unit Owners, on the unit on Unit Profile. */
function UnitTabsPart(): ReactElement {
  const { useUnits, useUnitOwnersGrid, useColumns, useBottomTab } =
    useViewModel();
  const { view } = useUnits();
  const ownersGrid = useUnitOwnersGrid();
  const ownersColumns = useColumns("unitOwners", UNIT_OWNERS_COLUMN_SPECS);
  const tabs = useBottomTab("units", UNIT_TABS);
  const target =
    tabs.state.active === "Unit Owners" ? view?.resident : view?.unit;

  return (
    <UnitTabs
      active={tabs.state.active}
      unit={view?.unit ?? null}
      location={view?.location ?? ""}
      ownerRows={ownersGrid.state.rows}
      ownersTemplate={ownersColumns.state.template}
      selectedResidentId={view?.selected?.residentId ?? null}
      onActivate={ignoreClose}
      onSelectOwner={ignoreClose}
      onToggleOwner={ignoreClose}
      onResizeOwners={ignoreClose}
      canAddOwner={view?.unit != null}
      canEdit={target != null}
      canDelete={target != null}
      onAddOwner={ignoreClose}
      onEdit={ignoreClose}
      onDelete={ignoreClose}
      onStub={ignoreClose}
    />
  );
}

/** The Building Data screen's bottom panel as the screen hands it its props. */
function BuildingTabsPart(): ReactElement {
  const { useBuildingData, useColumns, useSplit, useBottomTab } =
    useViewModel();
  const { view } = useBuildingData();
  const suppliersColumns = useColumns("suppliers", SUPPLIERS_COLUMN_SPECS);
  const suppliersSplit = useSplit("suppliers");
  const tabs = useBottomTab("buildingData", BUILDING_TABS);

  return (
    <BuildingTabs
      active={tabs.state.active}
      building={view.building}
      suppliers={view.suppliers}
      supplier={view.supplier}
      suppliersTemplate={suppliersColumns.state.template}
      suppliersRatio={suppliersSplit.state.ratio}
      onActivate={ignoreClose}
      onSelectSupplier={ignoreClose}
      onResizeSuppliers={ignoreClose}
      onSetSuppliersRatio={ignoreClose}
      onEditBuilding={ignoreClose}
      onAddSupplier={ignoreClose}
      onEditSupplier={ignoreClose}
      onRemoveSupplier={ignoreClose}
      onStub={ignoreClose}
    />
  );
}

/** The New Unit dialog over the period the Units screen shows; nothing until it shows one. */
function UnitDialogPart(): ReactElement | null {
  const { useUnits } = useViewModel();
  const { view } = useUnits();

  return view === null ? null : (
    <UnitDialog
      editing={null}
      period={view.period}
      onSaved={ignoreClose}
      onCancel={ignoreClose}
    />
  );
}

interface OwnerDialogPartProps {
  /** The resident Edit Owner opens on; null for Add Owner on the selected unit. */
  editing: string | null;
}

/** The owner dialog over the period the Units screen shows; nothing until it shows one. */
function OwnerDialogPart({
  editing,
}: OwnerDialogPartProps): ReactElement | null {
  const { useUnits } = useViewModel();
  const { view } = useUnits();

  return view === null ? null : (
    <OwnerDialog
      editing={editing}
      period={view.period}
      onSaved={ignoreClose}
      onCancel={ignoreClose}
    />
  );
}

/** Edit Building on the selected period's building; nothing until there is one. */
function BuildingDialogPart(): ReactElement | null {
  const { useBuildingData } = useViewModel();
  const { building } = useBuildingData().view;

  return building === null ? null : (
    <BuildingDialog
      buildingId={building.id}
      onSaved={ignoreClose}
      onCancel={ignoreClose}
    />
  );
}

/** The Address dialog as Edit Building opens it, on the selected period's building's address; nothing until there is one. */
function AddressDialogPart(): ReactElement | null {
  const { useBuildingData } = useViewModel();
  const { building } = useBuildingData().view;

  return building === null ? null : (
    <AddressDialog
      address={building.address}
      onApply={ignoreClose}
      onClose={ignoreClose}
    />
  );
}

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

/** The Calendars menu's box: the popover's own `.calendars-filter`, inset for its shadow. */
const MENU_BOX: CSSProperties = { margin: "0 12px" };

/** The deadlines column's box at 1280x720: the page's height less the top bar and the breadcrumb. */
const COLUMN_BOX: CSSProperties = { display: "flex", height: 619 };

/** The height of a day cell in a month of five weeks at 1280x720. */
const DAY_HEIGHT = 96;

/** A typed deadline's words need no name: its description is its own. */
const NAMES_UNUSED: DeadlineNames = {
  buildingName: unnamed,
  periodName: unnamed,
  supplierName: unnamed,
};

/** The surface of the panel a part sits on in the app: Account Details' sheet, under the mini-grid's rows and border. */
const PANEL_SURFACE: CSSProperties = { background: "var(--panel)" };

/** The building and period the wizard dialog's props name. */
const PICTURED_CONTEXT = {
  building: "Pozzetto",
  period: "2013",
  address: "Piazza Libertà, 74, 33045 Nimis",
};

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

/** The cells of a picture laid out as a week's: as many columns as cells, at a month's cell height. */
function dayRow(count: number): CSSProperties {
  return {
    gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
    height: DAY_HEIGHT,
  };
}

/** A cell's deadlines as the Calendar holds them: typed ones, on the cell's day. */
function deadlinesOf(cell: DayCellPicture): Deadline[] {
  const { day } = cell;

  if (day === null) {
    return [];
  }

  return cell.deadlines.map((picture: DeadlinePicture) => {
    return manual({
      id: picture.id,
      date: day,
      time: picture.time ?? null,
      calendar: picture.calendar,
      buildingId: null,
      description: picture.description,
      status: picture.status,
      priority: picture.priority ?? "none",
      notes: null,
    });
  });
}

/** An id is its own name: a typed deadline never asks. */
function unnamed(id: string): string {
  return id;
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
