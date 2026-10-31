import { distinctUntilChanged, map } from "rxjs";

import {
  type AccountsPort,
  type AccountsSimulator,
  type Address,
  type Allocation,
  type Building,
  type BuildingsPort,
  type BuildingsSimulator,
  type ClockPort,
  type ContactsPort,
  createAccountsSimulator,
  createBuildingsSimulator,
  createContactsSimulator,
  createInstallmentsSimulator,
  createJournalSimulator,
  createSessionSimulator,
  createTablesSimulator,
  createUnitsSimulator,
  DESIGN_FIRM,
  DESIGN_PRINCIPAL,
  type EntryKind,
  type InstallmentItem,
  type InstallmentsPort,
  type InstallmentsSimulator,
  type JournalEntry,
  type JournalPort,
  type JournalSimulator,
  type LegacySeed,
  type OwnerParty,
  ok,
  type PeriodDates,
  type Result,
  type SessionPort,
  type TablesPort,
  type ThousandthTable,
  type Unit,
  type UnitsPort,
  type UnitsSimulator,
} from "@cl/domain";
import { must } from "@cl/domain/support/must.ts";

import { amountTextsIn } from "./amounts.ts";
import {
  type AddressDialogState,
  type BuildingDialogState,
  createAddressDialog,
  createBuildingDialog,
  createPeriodDialog,
  type PeriodDialogState,
} from "./machines/buildingDialogMachines.ts";
import type { DialogIntents } from "./machines/formDialog.ts";
import {
  createInstallmentDialog,
  type InstallmentDialogIntents,
  type InstallmentDialogState,
} from "./machines/installmentDialogMachine.ts";
import {
  createJournalDialogMachine,
  type JournalDialogIntents,
  type JournalDialogState,
  type WizardName,
} from "./machines/journalDialogMachine.ts";
import type { Machine } from "./machines/machine.ts";
import {
  createMaximizeMachine,
  type MaximizeIntents,
  type MaximizeState,
} from "./machines/maximizeMachine.ts";
import {
  createNavigationMachine,
  type NavigationIntents,
  type NavigationState,
} from "./machines/navigationMachine.ts";
import {
  createSidebarMachine,
  type SidebarIntents,
  type SidebarState,
} from "./machines/sidebarMachine.ts";
import {
  createTableDialog,
  rewriting,
  type TableDialogIntents,
  type TableDialogState,
} from "./machines/tableDialogMachine.ts";
import {
  createGroupDialog,
  createOwnerDialog,
  createUnitDialog,
  type GroupDialogState,
  type OwnerDialogState,
  type UnitDialogState,
} from "./machines/unitDialogMachines.ts";
import {
  type BudgetAllocationForm,
  type BudgetAllocationSummary,
  createBudgetAllocationWizard,
} from "./machines/wizards/budgetAllocationWizard.ts";
import {
  type BudgetInstallmentsForm,
  type BudgetInstallmentsSummary,
  createBudgetInstallmentsWizard,
} from "./machines/wizards/budgetInstallmentsWizard.ts";
import {
  type CollectionForm,
  type CollectionSummary,
  createCollectionWizard,
} from "./machines/wizards/collectionWizard.ts";
import {
  createDirectPaymentWizard,
  type DirectPaymentForm,
  type DirectPaymentKind,
  type DirectPaymentSummary,
} from "./machines/wizards/directPaymentWizard.ts";
import { editorOf } from "./machines/wizards/editorOf.ts";
import {
  createGenericEntryWizard,
  type GenericEntryForm,
  type GenericEntrySummary,
} from "./machines/wizards/genericEntryWizard.ts";
import {
  createInvoicePaymentWizard,
  type InvoicePaymentForm,
  type InvoicePaymentSummary,
} from "./machines/wizards/invoicePaymentWizard.ts";
import {
  createInvoiceWizard,
  type InvoiceForm,
  type InvoiceSummary,
} from "./machines/wizards/invoiceWizard.ts";
import {
  createMultiCostPaymentWizard,
  type MultiCostPaymentForm,
  type MultiCostPaymentSummary,
} from "./machines/wizards/multiCostPaymentWizard.ts";
import {
  createOpeningBalancesWizard,
  type OpeningForm,
  type OpeningSummary,
} from "./machines/wizards/openingBalancesWizard.ts";
import {
  replacing,
  type WizardMachine,
  type WriteEntry,
} from "./machines/wizards/wizard.ts";
import { createNotices, type Notices } from "./notices.ts";
import {
  type AccountsPresenter,
  createAccountsPresenter,
} from "./presenters/accountsPresenter.ts";
import {
  type AllocationPresenter,
  createAllocationPresenter,
} from "./presenters/allocationPresenter.ts";
import {
  type Books,
  type BooksPresenter,
  createBooksPresenter,
} from "./presenters/booksPresenter.ts";
import {
  type BuildingDataPresenter,
  createBuildingDataPresenter,
} from "./presenters/buildingDataPresenter.ts";
import {
  type BuildingsPresenter,
  createBuildingsPresenter,
} from "./presenters/buildingsPresenter.ts";
import {
  createInstallmentSchedulePresenter,
  type InstallmentSchedulePresenter,
  scheduleContextOf,
} from "./presenters/installmentSchedulePresenter.ts";
import {
  createJournalPresenter,
  type JournalPresenter,
} from "./presenters/journalPresenter.ts";
import {
  createSessionPresenter,
  type SessionPresenter,
} from "./presenters/sessionPresenter.ts";
import {
  createUnitsPresenter,
  type UnitsPresenter,
  type UnitsSnapshot,
} from "./presenters/unitsPresenter.ts";
import { type AppScreens, createScreens } from "./screens.ts";
import { todayOf } from "./today.ts";

/** Everything the application needs from the outside world. The client's
 * composition root decides what stands behind each port. */
export interface AppPorts {
  session: SessionPort;
  buildings: BuildingsPort;
  contacts: ContactsPort;
  accounts: AccountsPort;
  journal: JournalPort;
  installments: InstallmentsPort;
  tables: TablesPort;
  units: UnitsPort;
  clock: ClockPort;
}

/** The shared state: one of each per application, however many readers. */
interface AppPresenters {
  session: SessionPresenter;
  buildings: BuildingsPresenter;
  books: BooksPresenter;
  accounts: AccountsPresenter;
  journal: JournalPresenter;
  schedule: InstallmentSchedulePresenter;
  allocation: AllocationPresenter;
  units: UnitsPresenter;
  buildingData: BuildingDataPresenter;
}

/** Per-component state: each call builds a machine of its own, for a dialog, a wizard or the shell's parts, disposed when the component goes. */
interface AppMachines {
  createMaximize: () => Machine<MaximizeState, MaximizeIntents>;
  createSidebar: () => Machine<SidebarState, SidebarIntents>;
  /** The dialog over the selected period's books as they stand when an intent asks: an edit opens only for an entry they hold. */
  createJournalDialog: () => Machine<JournalDialogState, JournalDialogIntents>;
  /**
   * The wizards are built over the selected period's books as they stand:
   * with no period, no choices and a refused verdict. `editing` names an entry
   * of those books to rewrite, keeping its kind; one they do not hold throws.
   * Left out, the wizard writes a new entry. Each reads and writes amounts
   * in the session's locale as it stands when it judges.
   */
  createDirectPaymentWizard: (
    kind: DirectPaymentKind,
    editing?: string | null,
  ) => WizardMachine<DirectPaymentForm, DirectPaymentSummary>;
  createMultiCostPaymentWizard: (
    editing?: string | null,
  ) => WizardMachine<MultiCostPaymentForm, MultiCostPaymentSummary>;
  /** `kind` is what the generic wizard writes; left out, generic for a new entry and the edited entry's own kind for an edit. */
  createGenericEntryWizard: (
    editing?: string | null,
    kind?: EntryKind,
  ) => WizardMachine<GenericEntryForm, GenericEntrySummary>;
  /** The New invoice wizard, its date from the application's clock; `editing` names an invoice's registration to rewrite. */
  createInvoiceWizard: (
    editing: string | null,
  ) => WizardMachine<InvoiceForm, InvoiceSummary>;
  /** The Invoice payment wizard, its overdue marking from the application's clock; `editing` names an invoice payment to rewrite, from step 2. */
  createInvoicePaymentWizard: (
    editing: string | null,
  ) => WizardMachine<InvoicePaymentForm, InvoicePaymentSummary>;
  /** The Opening balances wizard; `editing` names the period's opening to rewrite. */
  createOpeningBalancesWizard: (
    editing: string | null,
  ) => WizardMachine<OpeningForm, OpeningSummary>;
  /** The Record owner collection wizard, its prefilled amount due by the application's clock; `editing` names a collection to rewrite, from step 2. */
  createCollectionWizard: (
    editing: string | null,
  ) => WizardMachine<CollectionForm, CollectionSummary>;
  /** The Create Budget Installments wizard over the selected period's books as they stand: with no period, refused. Its percentages are read and written in the session's locale. */
  createBudgetInstallmentsWizard: () => WizardMachine<
    BudgetInstallmentsForm,
    BudgetInstallmentsSummary,
    Result
  >;
  /** The Budget allocation wizard over the selected period's books and its budget allocation as they stand: with no period, refused. */
  createBudgetAllocationWizard: () => WizardMachine<
    BudgetAllocationForm,
    BudgetAllocationSummary
  >;
  /** The New Thousandth Table dialog over the selected period's tables as they stand, or with `editing` the Edit one on a table of them; one they do not hold throws. Its save answers the table's id, the new one's or the edited one's. */
  createTableDialog: (
    editing: string | null,
  ) => Machine<TableDialogState, TableDialogIntents>;
  /** The Edit Installment dialog over an installment of the selected period's books as they stand; one they do not hold throws. */
  createInstallmentDialog: (
    installmentId: string,
  ) => Machine<InstallmentDialogState, InstallmentDialogIntents>;
  /**
   * The New Group dialog over the Units screen as it stands, under the
   * selected group, or the selected unit's or resident's group, else at the
   * top; with `editing` the Edit Group one on a group of the period. One the
   * period does not hold, or no period, throws.
   */
  createGroupDialog: (
    editing: string | null,
  ) => Machine<GroupDialogState, DialogIntents<GroupDialogState["form"]>>;
  /** The New Unit dialog, in the group a new group would go under; with `editing` the Edit Unit one. Throws as createGroupDialog does. */
  createUnitDialog: (
    editing: string | null,
  ) => Machine<UnitDialogState, DialogIntents<UnitDialogState["form"]>>;
  /** The Add Owner dialog on the selected unit, or the selected resident's; with `editing` the Edit Owner one on a resident. Its balance is read in the session's locale. Throws with no unit selected, and as createGroupDialog does. */
  createOwnerDialog: (
    editing: string | null,
  ) => Machine<OwnerDialogState, DialogIntents<OwnerDialogState["form"]>>;
  /** The Edit Building dialog on a building of the tree as it stands; one it does not hold throws. A construction date typed without a year is in the clock's. */
  createBuildingDialog: (
    buildingId: string,
  ) => Machine<BuildingDialogState, DialogIntents<BuildingDialogState["form"]>>;
  /** The Edit Management / Period dialog on a period of the tree, judged against its units and residents as they stand; one the tree does not hold throws. */
  createPeriodDialog: (
    periodId: string,
  ) => Machine<PeriodDialogState, DialogIntents<PeriodDialogState["form"]>>;
  /** The Address dialog on `address`; its save hands the address to `apply`. */
  createAddressDialog: (
    address: Address | null,
    apply: (address: Address) => void,
  ) => Machine<AddressDialogState, DialogIntents<AddressDialogState["form"]>>;
}

/** The application, built once at startup. Presenters, the navigation, the
 * notices and the screens' state are shared; machine factories build one
 * machine per component that asks. */
export interface App {
  presenters: AppPresenters;
  navigation: Machine<NavigationState, NavigationIntents>;
  notices: Notices;
  screens: AppScreens;
  machines: AppMachines;
}

export function createApp(ports: AppPorts): App {
  const session = createSessionPresenter(ports.session);
  const buildings = createBuildingsPresenter(ports.buildings);
  const books = createBooksPresenter(
    {
      accounts: ports.accounts,
      journal: ports.journal,
      installments: ports.installments,
    },
    buildings.selected$,
    buildings.tree$,
  );

  const allocation = createAllocationPresenter(
    books.books$,
    buildings.tree$,
    { tables: ports.tables, units: ports.units },
    session.amountLocale$,
  );

  const units = createUnitsPresenter(
    books.books$,
    buildings.tree$,
    { units: ports.units, tables: ports.tables, contacts: ports.contacts },
    ports.clock,
  );

  const buildingData = createBuildingDataPresenter(
    {
      accounts: ports.accounts,
      journal: ports.journal,
      installments: ports.installments,
      tables: ports.tables,
      units: ports.units,
      buildings: ports.buildings,
      contacts: ports.contacts,
    },
    buildings,
    ports.clock,
  );

  const periodTables$ = allocation.tables$.pipe(
    map((views) => {
      return views.map((view) => {
        return view.table;
      });
    }),
  );

  const accounts = createAccountsPresenter(
    books.books$,
    ports.accounts,
    periodTables$,
  );

  const journal = createJournalPresenter(
    books.books$,
    buildings.tree$,
    buildings.selected$,
    ports.journal,
  );

  const schedule = createInstallmentSchedulePresenter(
    books.books$,
    buildings.tree$,
    ports.installments,
    ports.clock,
    ports.units,
  );

  let latestBooks: Books | null = null;
  let latestTables: ThousandthTable[] = [];
  let latestBudgetAllocation: Allocation | null = null;

  // The books presenter lives as long as the application: nothing unsubscribes.
  books.books$.subscribe((next) => {
    latestBooks = next;
  });
  // The table dialog and the Budget allocation wizard are built over the
  // period's tables and budget allocation as they stand: held for the
  // application's life, as the books are.
  periodTables$.subscribe((tables) => {
    latestTables = tables;
  });
  allocation.allocation$("budget").subscribe((next) => {
    latestBudgetAllocation = next;
  });
  // The wizards read the amounts' locale as it stands whenever they judge:
  // held for the application's life, so it always has the session's.
  session.amountLocale$.subscribe();

  const texts = amountTextsIn(session.amountLocale$);

  /** The entry of the books as they stand that a wizard rewrites; null for a new entry. */
  function editedEntry(editing: string | null): JournalEntry | null {
    return editing === null
      ? null
      : must(
          latestBooks?.entries.find((entry) => {
            return entry.id === editing;
          }),
          `the entry ${editing}`,
        );
  }

  /** The wizard that edits an entry of the books as they stand; null for one they do not hold, or that cannot be edited. */
  function editorOfHeld(entryId: string): WizardName | null {
    const books = latestBooks;

    if (books === null) {
      return null;
    }

    const entry = books.entries.find((candidate) => {
      return candidate.id === entryId;
    });

    return entry === undefined ? null : editorOf(entry, books);
  }

  /** The period's opening entry in the books as they stand; null when it has none. */
  function openingEntry(): string | null {
    return (
      latestBooks?.entries.find((entry) => {
        return entry.kind === "openingBalances";
      })?.id ?? null
    );
  }

  /** The Units screen as it stands, for a dialog over it. */
  function unitsNow(): UnitsSnapshot {
    return must(units.snapshot(), "the units of the selected period");
  }

  /** How a wizard writes: a new entry is added, an edited one replaced. */
  function writeOf(entry: JournalEntry | null): WriteEntry {
    return entry === null
      ? journal.addEntry
      : replacing(entry.id, journal.replaceEntry);
  }

  return {
    presenters: {
      session,
      buildings,
      books,
      accounts,
      journal,
      schedule,
      allocation,
      units,
      buildingData,
    },
    navigation: createNavigationMachine(),
    notices: createNotices(),
    screens: createScreens({
      accountsTree$: accounts.tree$,
      journalEntries$: journal.entries$,
      schedule$: schedule.schedule$,
      tables$: allocation.tables$,
      coefficients$: allocation.coefficients$,
      allocation$: allocation.allocation$,
      units$: units.view$,
      buildingData$: buildingData.view$,
      period$: buildings.selected$.pipe(
        map((selected) => {
          return selected?.periodId ?? null;
        }),
        distinctUntilChanged(),
      ),
    }),
    machines: {
      createMaximize: createMaximizeMachine,
      createSidebar: createSidebarMachine,
      createJournalDialog: (): Machine<
        JournalDialogState,
        JournalDialogIntents
      > => {
        return createJournalDialogMachine({
          editorOf: editorOfHeld,
          openingEntry,
        });
      },
      createDirectPaymentWizard: (
        kind: DirectPaymentKind,
        editing: string | null = null,
      ): WizardMachine<DirectPaymentForm, DirectPaymentSummary> => {
        const entry = editedEntry(editing);

        return createDirectPaymentWizard(
          texts,
          kind,
          latestBooks,
          writeOf(entry),
          entry,
        );
      },
      createMultiCostPaymentWizard: (
        editing: string | null = null,
      ): WizardMachine<MultiCostPaymentForm, MultiCostPaymentSummary> => {
        const entry = editedEntry(editing);

        return createMultiCostPaymentWizard(
          texts,
          latestBooks,
          writeOf(entry),
          entry,
        );
      },
      createGenericEntryWizard: (
        editing: string | null = null,
        kind?: EntryKind,
      ): WizardMachine<GenericEntryForm, GenericEntrySummary> => {
        const entry = editedEntry(editing);

        return createGenericEntryWizard(
          texts,
          latestBooks,
          writeOf(entry),
          entry,
          kind,
        );
      },
      createInvoiceWizard: (
        editing: string | null,
      ): WizardMachine<InvoiceForm, InvoiceSummary> => {
        const entry = editedEntry(editing);

        return createInvoiceWizard(
          texts,
          latestBooks,
          ports.clock,
          writeOf(entry),
          entry,
        );
      },
      createInvoicePaymentWizard: (
        editing: string | null,
      ): WizardMachine<InvoicePaymentForm, InvoicePaymentSummary> => {
        const entry = editedEntry(editing);

        return createInvoicePaymentWizard(
          texts,
          latestBooks,
          ports.clock,
          writeOf(entry),
          entry,
          (): Books | null => {
            return latestBooks;
          },
        );
      },
      createOpeningBalancesWizard: (
        editing: string | null,
      ): WizardMachine<OpeningForm, OpeningSummary> => {
        const entry = editedEntry(editing);

        return createOpeningBalancesWizard(
          texts,
          latestBooks,
          writeOf(entry),
          entry,
        );
      },
      createCollectionWizard: (
        editing: string | null,
      ): WizardMachine<CollectionForm, CollectionSummary> => {
        const entry = editedEntry(editing);

        return createCollectionWizard(
          texts,
          latestBooks,
          ports.clock,
          writeOf(entry),
          entry,
          (): Books | null => {
            return latestBooks;
          },
        );
      },
      createBudgetInstallmentsWizard: (): WizardMachine<
        BudgetInstallmentsForm,
        BudgetInstallmentsSummary,
        Result
      > => {
        const books = latestBooks;

        return createBudgetInstallmentsWizard(
          texts,
          books,
          (draft) => {
            // Only a wizard over books writes: with none, its verdict refuses.
            return schedule.createInstallments(
              must(books, "the books of the batch").periodId,
              draft,
            );
          },
          (): Books | null => {
            return latestBooks;
          },
        );
      },
      createBudgetAllocationWizard: (): WizardMachine<
        BudgetAllocationForm,
        BudgetAllocationSummary
      > => {
        return createBudgetAllocationWizard(
          latestBooks,
          latestBudgetAllocation,
          journal.addEntry,
        );
      },
      createTableDialog: (
        editing: string | null,
      ): Machine<TableDialogState, TableDialogIntents> => {
        const tables = latestTables;

        if (editing === null) {
          return createTableDialog(tables, null, allocation.addTable);
        }

        const table = must(
          tables.find((candidate) => {
            return candidate.id === editing;
          }),
          `the table ${editing}`,
        );

        return createTableDialog(
          tables,
          table,
          rewriting(editing, allocation.editTable),
        );
      },
      createInstallmentDialog: (
        installmentId: string,
      ): Machine<InstallmentDialogState, InstallmentDialogIntents> => {
        const books = must(latestBooks, `the installment ${installmentId}`);
        const installment = must(
          books.installments.find((candidate) => {
            return candidate.id === installmentId;
          }),
          `the installment ${installmentId}`,
        );

        return createInstallmentDialog(
          installment,
          (patch) => {
            return schedule.updateInstallment(installmentId, patch);
          },
          scheduleContextOf(books),
        );
      },
      createGroupDialog: (
        editing: string | null,
      ): Machine<GroupDialogState, DialogIntents<GroupDialogState["form"]>> => {
        const { groups, selected } = unitsNow();

        if (editing === null) {
          const parentId = selected?.groupId ?? null;

          return createGroupDialog(
            { groups, parentId, editing: null },
            (draft) => {
              return units.addGroup(parentId, draft);
            },
          );
        }

        const group = must(
          groups.find((candidate) => {
            return candidate.id === editing;
          }),
          `the group ${editing}`,
        );

        return createGroupDialog(
          { groups, parentId: group.parentId, editing: group },
          (draft) => {
            return units.editGroup(editing, draft);
          },
        );
      },
      createUnitDialog: (
        editing: string | null,
      ): Machine<UnitDialogState, DialogIntents<UnitDialogState["form"]>> => {
        const snapshot = unitsNow();
        const { period } = snapshot;

        if (editing === null) {
          const groupId = snapshot.selected?.groupId ?? null;

          return createUnitDialog(
            { units: snapshot.units, period, editing: null },
            (draft) => {
              return units.addUnit(groupId, draft);
            },
          );
        }

        const unit = must(
          snapshot.units.find((candidate) => {
            return candidate.id === editing;
          }),
          `the unit ${editing}`,
        );

        return createUnitDialog(
          { units: snapshot.units, period, editing: unit },
          (draft) => {
            return units.editUnit(editing, draft);
          },
        );
      },
      createOwnerDialog: (
        editing: string | null,
      ): Machine<OwnerDialogState, DialogIntents<OwnerDialogState["form"]>> => {
        const { residents, period, openingPosted, selected } = unitsNow();

        if (editing === null) {
          const unitId = must(selected?.unitId, "the unit of the new owner");

          return createOwnerDialog(
            texts,
            { unitId, residents, period, openingPosted, editing: null },
            (draft) => {
              return units.addResident(unitId, draft);
            },
          );
        }

        const resident = must(
          residents.find((candidate) => {
            return candidate.id === editing;
          }),
          `the resident ${editing}`,
        );

        return createOwnerDialog(
          texts,
          {
            unitId: resident.unitId,
            residents,
            period,
            openingPosted,
            editing: resident,
          },
          (draft) => {
            return units.editResident(editing, draft);
          },
        );
      },
      createBuildingDialog: (
        buildingId: string,
      ): Machine<
        BuildingDialogState,
        DialogIntents<BuildingDialogState["form"]>
      > => {
        const tree = buildings.tree$.getValue();
        const building = must(
          tree.find((candidate) => {
            return candidate.id === buildingId;
          }),
          `the building ${buildingId}`,
        );

        return createBuildingDialog(
          {
            buildings: tree,
            editing: building,
            year: Number(todayOf(ports.clock).slice(0, 4)),
          },
          (draft) => {
            return buildingData.editBuilding(buildingId, draft);
          },
        );
      },
      createPeriodDialog: (
        periodId: string,
      ): Machine<
        PeriodDialogState,
        DialogIntents<PeriodDialogState["form"]>
      > => {
        return createPeriodDialog(
          buildingData.periodContext(periodId),
          (draft) => {
            return buildingData.editPeriod(periodId, draft);
          },
        );
      },
      createAddressDialog: (
        address: Address | null,
        apply: (address: Address) => void,
      ): Machine<
        AddressDialogState,
        DialogIntents<AddressDialogState["form"]>
      > => {
        return createAddressDialog(address, (saved) => {
          apply(saved);

          return Promise.resolve(ok());
        });
      },
    },
  };
}

/**
 * The eight simulators over one seed: what `pnpm dev` and the harness run on.
 * The units simulator is the one source of each period's units and
 * residents: the accounts and the tables follow its streams, and the journal
 * and the installments read its residents when a write asks. It judges a
 * delete against the journal and the schedule as they stand. The journal and
 * the installments read each other's current state, so a collection is judged
 * against the schedule as it stands and an installment a collection pays is
 * not deleted. Each reads another only when a write asks, after all are
 * built. A table is deleted only when no account, as the accounts simulator
 * holds it now, links to it.
 */
export function createSimulatorPorts(
  seed: LegacySeed,
  clock: ClockPort,
): AppPorts {
  const units: UnitsSimulator = createUnitsSimulator(seed, {
    entriesOf: (periodId: string): JournalEntry[] => {
      return journal.current(periodId);
    },
    itemsOf: (periodId: string): InstallmentItem[] => {
      return installments.current(periodId).items;
    },
    periodOf: (periodId: string): PeriodDates => {
      return datesOfPeriod(buildings.currentBuildings(), periodId);
    },
  });

  const buildings: BuildingsSimulator = createBuildingsSimulator(seed, clock, {
    unitsOf: (periodId: string): Unit[] => {
      return units.currentUnits(periodId);
    },
    residentsOf: (periodId: string): OwnerParty[] => {
      return units.currentResidents(periodId);
    },
  });

  const journal: JournalSimulator = createJournalSimulator(
    seed,
    clock,
    (periodId) => {
      return installments.current(periodId);
    },
    (periodId) => {
      return units.currentResidents(periodId);
    },
  );

  const installments: InstallmentsSimulator = createInstallmentsSimulator(
    seed,
    (periodId) => {
      return journal.current(periodId);
    },
    (periodId) => {
      return units.currentResidents(periodId);
    },
  );

  const accounts: AccountsSimulator = createAccountsSimulator(
    seed,
    (periodId) => {
      return units.residents(periodId);
    },
  );

  return {
    session: createSessionSimulator({
      principal: DESIGN_PRINCIPAL,
      firm: DESIGN_FIRM,
    }),
    buildings,
    contacts: createContactsSimulator(seed),
    accounts,
    journal,
    installments,
    tables: createTablesSimulator(
      seed,
      (periodId) => {
        return accounts.current(periodId);
      },
      (periodId) => {
        return units.units(periodId);
      },
    ),
    units,
    clock,
  };
}

/** A period's dates as the buildings stand now; throws for a period they do not hold. */
function datesOfPeriod(buildings: Building[], periodId: string): PeriodDates {
  const period = must(
    buildings
      .flatMap((building) => {
        return building.periods;
      })
      .find((candidate) => {
        return candidate.id === periodId;
      }),
    `the period ${periodId}`,
  );

  return { start: period.start, end: period.end };
}
