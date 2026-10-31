import {
  type AccountData,
  type AccountNature,
  type AccountRole,
  type AccountType,
  type Building,
  type Coefficient,
  type Contact,
  type Counterpart,
  type EntryKind,
  type Installment,
  type InstallmentItemData,
  type InvoiceData,
  type JournalEntryData,
  type LegacySeedData,
  type LinkUse,
  type PartyData,
  type Period,
  type PostingData,
  type Restriction,
  type RolePresence,
  type RoleShares,
  romeTime,
  type SupplierLink,
  type TableLink,
  type ThousandthTable,
  type Unit,
  type UnitGroup,
  type UnitType,
  type WithholdingTaxData,
} from "@cl/domain";

import { eur } from "../amounts.ts";
import type { Db } from "../db.ts";
import type { Row } from "../loadRows.ts";
import { reconcilePeriods } from "../reconcile.ts";
import { unitTypeOf } from "../translate/exact.ts";
import { masterDataName, projectContact } from "./masterData.ts";
import { addressOf, buildingProfileOf, projectTree } from "./structure.ts";

const ROLE_COLUMNS: Record<string, AccountRole> = {
  paymentInCashLedgerAccountId: "cash",
  defaultCheckingAccountLedgerAccountId: "bank",
  supplierAccountsPayableLedgerAccountId: "suppliers",
  flatResidentAccountsReceivableLedgerAccountId: "owners",
  flatResidentRoundingOffLedgerAccountId: "roundings",
};

/** A role held by the one top-level account of a nature with a name, which the legacy period names in no column. */
interface NamedRole {
  name: string;
  nature: AccountNature;
  role: AccountRole;
}

const NAMED_ROLES: readonly NamedRole[] = [
  { name: "Liquidità", nature: "assets", role: "liquidity" },
  { name: "Fondi", nature: "liabilities", role: "funds" },
];

// Every nature and type the domain knows, so a value the dump has and the
// domain does not is refused here rather than cast through.
const NATURES: Record<AccountNature, true> = {
  assets: true,
  liabilities: true,
  assetsOrLiabilities: true,
  income: true,
  expenses: true,
};

const TYPES: Record<AccountType, true> = {
  grouping: true,
  regular: true,
  control: true,
  controlUnitResident: true,
};

/** The dump's expenseLA2Table.type, in the domain's words. An untyped link serves both allocations. */
const LINK_USES: Record<string, LinkUse> = {
  estimate: "budget",
  currentBalance: "finalBalance",
};

type Priority = keyof RoleShares;

const PRIORITIES: Record<string, Priority> = { 1: 1, 2: 2, 3: 3, 4: 4 };

/** The dump's ledgerTransaction.type, in the domain's words. An untyped transaction is a generic entry. */
export const ENTRY_KIND_OF_TYPE: Record<string, EntryKind> = {
  startingBalance: "openingBalances",
  closingBalance: "closingBalances",
  ledgerInvoiceRegistration: "invoice",
  ledgerInvoicePayment: "invoicePayment",
  unitResidentTakings: "collection",
  estimateDistribution: "budgetAllocation",
  individualExpense: "individualExpense",
  directPaymentInCash: "directPaymentCash",
  checkingAccountDirectPayment: "directPaymentBank",
  withholdingTaxPayment: "withholdingPayment",
};

/** The periods with balanced books, as the simulators read them. */
export function projectLegacySeed(db: Db): LegacySeedData {
  const status = reconcilePeriods(db);
  const periodRows = db.by("accountingPeriod", "id");
  const buildings: Building[] = projectTree(db)
    .map((node) => {
      return {
        node,
        periods: node.periods
          .filter((period) => {
            const legacyId = period.id.slice(1);
            return (
              status[legacyId]?.hasBooks === true &&
              status[legacyId]?.reconciles === true
            );
          })
          .map((period): Period => {
            return {
              id: period.id,
              name: period.name.replace(/ \(.*\)$/, ""),
              type: period.type,
              start: period.start,
              end: period.end,
              closed: period.closed,
              notes: text(periodRows.get(period.id.slice(1))?.notes) ?? null,
            };
          }),
      };
    })
    .filter((building) => {
      return building.periods.length > 0;
    })
    .map(({ node, periods }) => {
      return {
        id: node.id,
        name: node.name,
        ...buildingProfileOf(db, node.id.slice(1)),
        periods,
      };
    });

  const periodIds = buildings.flatMap((building) => {
    return building.periods.map((period) => {
      return period.id.slice(1);
    });
  });

  const accounts = periodIds.flatMap((periodId) => {
    return projectAccounts(db, periodId);
  });

  const entries = periodIds.flatMap((periodId) => {
    return projectEntries(
      db,
      periodId,
      new Set(
        accounts
          .filter((account) => {
            return account.periodId === `p${periodId}`;
          })
          .map((account) => {
            return account.id;
          }),
      ),
    );
  });

  const parties = periodIds.map((periodId) => {
    return {
      periodId: `p${periodId}`,
      parties: projectParties(db, periodId),
    };
  });

  return {
    buildings,
    accounts,
    entries,
    parties,
    invoices: periodIds.flatMap((periodId) => {
      return projectInvoices(db, periodId, entries);
    }),
    withholdingTaxes: periodIds.flatMap((periodId) => {
      return projectWithholdingTaxes(db, periodId);
    }),
    installments: periodIds.flatMap((periodId) => {
      return projectInstallments(db, periodId);
    }),
    installmentItems: periodIds.flatMap((periodId) => {
      return projectInstallmentItems(db, periodId);
    }),
    units: periodIds.flatMap((periodId) => {
      return projectUnits(db, periodId);
    }),
    unitGroups: periodIds.flatMap((periodId) => {
      return projectUnitGroups(db, periodId);
    }),
    tables: periodIds.flatMap((periodId) => {
      return projectTables(db, periodId);
    }),
    coefficients: periodIds.flatMap((periodId) => {
      return projectCoefficients(db, periodId);
    }),
    contacts: projectContacts(
      db,
      parties.flatMap((list) => {
        return list.parties;
      }),
    ),
    supplierLinks: buildings.flatMap((building) => {
      return projectSupplierLinks(db, building.id);
    }),
  };
}

/** The contact of every party, each once, by name. */
function projectContacts(db: Db, parties: PartyData[]): Contact[] {
  const ids = new Set(
    parties.map((party) => {
      return (party.kind === "owner" ? party.personId : party.id).slice(2);
    }),
  );

  return [...ids]
    .map((id) => {
      return projectContact(db, id);
    })
    .sort((a, b) => {
      return a.name.localeCompare(b.name, "it") || a.id.localeCompare(b.id);
    });
}

/** The building's suppliers, by contact id. */
function projectSupplierLinks(db: Db, buildingId: string): SupplierLink[] {
  return db
    .rows("condominiumSupplier")
    .filter((row) => {
      return `c${String(row.condominiumId)}` === buildingId;
    })
    .map((row) => {
      return String(row.masterDataId);
    })
    .sort(byNumber)
    .map((id) => {
      return { buildingId, contactId: `md${id}` };
    });
}

/** The TypeScript module the domain's simulators import. */
export function renderLegacySeedModule(data: LegacySeedData): string {
  return [
    "// GENERATED by packages/legacy-import: `pnpm --filter @cl/legacy-import gen:data`. Do not edit.",
    'import type { LegacySeedData } from "./legacySeed.ts";',
    "",
    `export const legacySeedData: LegacySeedData = ${JSON.stringify(data, null, 2)};`,
    "",
  ].join("\n");
}

function projectAccounts(db: Db, periodId: string): AccountData[] {
  const period = must(
    db.by("accountingPeriod", "id").get(periodId),
    `the period ${periodId}`,
  );

  const rows = db.rows("ledgerAccount").filter((row) => {
    return String(row.accountingPeriodId) === periodId;
  });

  const ids = new Set(
    rows.map((row) => {
      return String(row.id);
    }),
  );
  const roles = new Map<string, AccountRole>();

  for (const [column, role] of Object.entries(ROLE_COLUMNS)) {
    const id = text(period[column]);

    if (id !== undefined) {
      assignRole(roles, id, role);
    }
  }

  for (const { name, nature, role } of NAMED_ROLES) {
    const named = rows.filter((row) => {
      return (
        text(row.parentLedgerAccountId) === undefined &&
        String(row.kind) === nature &&
        text(row.name) === name
      );
    });

    if (named.length !== 1) {
      throw new Error(
        `the period ${periodId} has ${named.length} top-level ${nature} accounts named ${name}; it needs one`,
      );
    }

    assignRole(roles, String(named[0]?.id), role);
  }

  for (const link of db.rows("withholdingTax2LA")) {
    const id = text(link.ledgerAccountId);
    const account =
      id === undefined ? undefined : db.by("ledgerAccount", "id").get(id);

    if (id !== undefined && ids.has(id)) {
      assignRole(roles, id, "tax");
      const parent = text(account?.parentLedgerAccountId);

      if (parent !== undefined && ids.has(parent)) {
        assignRole(roles, parent, "tax");
      }
    }
  }

  for (const id of budgetAllocationRevenues(db, periodId, roles)) {
    assignRole(roles, id, "budgetAllocation");
  }

  const estimates = db.by("expenseLedgerAccount", "ledgerAccountId");
  const links = db.group("expenseLA2Table", "expenseLedgerAccountId");
  const linkRoles = db.group("expenseLA2Role", "expenseLA2TableId");

  return rows.map((row) => {
    const id = String(row.id);
    const parent = text(row.parentLedgerAccountId);
    const estimate = text(estimates.get(id)?.estimate);

    if (parent !== undefined && !ids.has(parent)) {
      throw new Error(
        `the account ${id} has the parent ${parent}, which is not an account of the period ${periodId}`,
      );
    }

    return {
      id: `la${id}`,
      periodId: `p${periodId}`,
      parentId: parent === undefined ? null : `la${parent}`,
      name: String(row.name),
      order: orderOf(row, `the account ${id}`),
      nature: natureOf(row, id),
      type: typeOf(row, id),
      role: roles.get(id) ?? null,
      budget: estimate === undefined ? null : eur(estimate).cents,
      abbreviation: text(row.abbreviation) ?? null,
      links: (links.get(id) ?? [])
        .slice()
        .sort(byId)
        .map((link) => {
          return projectLink(link, linkRoles.get(String(link.id)) ?? []);
        }),
    };
  });
}

/**
 * The accounts a stored budget allocation of the period credits, apart from
 * the owners' and the roundings accounts: the revenue it was posted to. The
 * legacy period names no such account; the entry is the evidence.
 */
function budgetAllocationRevenues(
  db: Db,
  periodId: string,
  roles: Map<string, AccountRole>,
): Set<string> {
  const allocations = new Set(
    db
      .rows("ledgerTransaction")
      .filter((row) => {
        return (
          String(row.accountingPeriodId) === periodId &&
          text(row.type) === "estimateDistribution"
        );
      })
      .map((row) => {
        return String(row.id);
      }),
  );
  const revenues = new Set<string>();

  for (const line of db.rows("ledgerEntry")) {
    const id = text(line.postingAccountId);
    const role = id === undefined ? undefined : roles.get(id);

    if (
      id !== undefined &&
      allocations.has(String(line.ledgerTransactionId)) &&
      eur(text(line.amount)).cents < 0 &&
      role !== "owners" &&
      role !== "roundings"
    ) {
      revenues.add(id);
    }
  }

  return revenues;
}

/** An expenseLA2Table row and its expenseLA2Role rows. A role with no row is absent, which is not the same as a row with an empty percentage. */
function projectLink(link: Row, roleRows: Row[]): TableLink {
  const id = String(link.id);
  const type = text(link.type);
  const roles: RoleShares = { 1: null, 2: null, 3: null, 4: null };
  const present: RolePresence = { 1: false, 2: false, 3: false, 4: false };

  if (type !== undefined && !Object.hasOwn(LINK_USES, type)) {
    throw new Error(
      `the link ${id} has the type ${type}, which the domain does not know`,
    );
  }

  for (const row of roleRows) {
    const priority = String(row.unitResidentPriorityId);

    if (!Object.hasOwn(PRIORITIES, priority)) {
      throw new Error(
        `the link ${id} has a role of priority ${priority}, which the domain does not know`,
      );
    }

    const key = PRIORITIES[priority] as Priority;

    present[key] = true;
    roles[key] = scaledOrNull(
      row.percentage,
      2,
      "hundredths",
      `the percentage of the role ${priority} of the link ${id}`,
    );
  }

  return {
    id: `el${id}`,
    accountId: `la${String(link.expenseLedgerAccountId)}`,
    tableId: `dt${String(link.distributionTableId)}`,
    use: type === undefined ? "both" : (LINK_USES[type] as LinkUse),
    percentage: scaledOrNull(
      link.percentage,
      2,
      "hundredths",
      `the percentage of the link ${id}`,
    ),
    roles,
    present,
  };
}

/** The period's units in id order. One with more than one unit period (a change of ownership scenario) is refused: the allocation reads only one. */
function projectUnits(db: Db, periodId: string): Unit[] {
  const unitPeriods = db.group("unitPeriod", "unitId");

  return db
    .rows("unit")
    .filter((row) => {
      return String(row.accountingPeriodId) === periodId;
    })
    .sort(byId)
    .map((row) => {
      const id = String(row.id);
      const count = unitPeriods.get(id)?.length ?? 0;
      const group = text(row.unitGroupId);

      if (count > 1) {
        throw new Error(
          `the unit ${id} has ${count} unit periods; the allocation reads only one`,
        );
      }

      return {
        id: `u${id}`,
        periodId: `p${periodId}`,
        code: must(text(row.code), `the code of the unit ${id}`),
        groupId: group === undefined ? null : `ug${group}`,
        restriction: restrictionOf(row),
        name: text(row.name) ?? null,
        floor: text(row.floor) ?? null,
        interior: text(row.innerNumber) ?? null,
        subUnit: text(row.subordinateNumber) ?? null,
        type: unitTypeOfRow(db, row),
        cadastralData: text(row.landRegistry) ?? null,
        notes: text(row.notes) ?? null,
      };
    });
}

/** The period's unit groups in id order. */
function projectUnitGroups(db: Db, periodId: string): UnitGroup[] {
  return db
    .rows("unitGroup")
    .filter((row) => {
      return String(row.accountingPeriodId) === periodId;
    })
    .sort(byId)
    .map((row) => {
      const parent = text(row.parentUnitGroupId);

      return {
        id: `ug${String(row.id)}`,
        periodId: `p${periodId}`,
        code: String(row.code),
        name: String(row.name),
        parentId: parent === undefined ? null : `ug${parent}`,
        address: addressOf(db, row.address),
        notes: text(row.notes) ?? null,
      };
    });
}

/** A unit's type, by the name of its row in the dump's unitType table. */
function unitTypeOfRow(db: Db, unit: Row): UnitType {
  const id = String(unit.id);
  const typeId = text(unit.unitTypeId);
  const name = must(
    text(
      typeId === undefined
        ? undefined
        : db.by("unitType", "id").get(typeId)?.name,
    ),
    `the type of the unit ${id}`,
  );
  const type = unitTypeOf(name);

  if (type === undefined) {
    throw new Error(
      `the unit ${id} has the type ${name}, which the domain does not know`,
    );
  }

  return type;
}

/** The period's thousandth tables by their order, then id. */
function projectTables(db: Db, periodId: string): ThousandthTable[] {
  return tableRowsOf(db, periodId).map((row) => {
    const id = String(row.id);
    const group = text(row.restrictionUnitGroupId);

    return {
      id: `dt${id}`,
      periodId: `p${periodId}`,
      name: String(row.name),
      order: orderOf(row, `the table ${id}`),
      notes: text(row.notes) ?? "",
      restrictionGroupId: group === undefined ? null : `ug${group}`,
    };
  });
}

/** Each table's coefficients, table by table, each in unit id order, in ten-thousandths. */
function projectCoefficients(db: Db, periodId: string): Coefficient[] {
  const items = db.group("distributionTableItem", "distributionTableId");

  return tableRowsOf(db, periodId).flatMap((table) => {
    const tableId = String(table.id);

    return (items.get(tableId) ?? [])
      .slice()
      .sort((a, b) => {
        return Number(a.unitId) - Number(b.unitId);
      })
      .map((item) => {
        const unitId = String(item.unitId);
        const what = `the coefficient of the unit ${unitId} in the table ${tableId}`;

        return {
          tableId: `dt${tableId}`,
          unitId: `u${unitId}`,
          value: scaled(
            must(text(item.coefficient), what),
            4,
            "ten-thousandths",
            what,
          ),
        };
      });
  });
}

function tableRowsOf(db: Db, periodId: string): Row[] {
  return db
    .rows("distributionTable")
    .filter((row) => {
      return String(row.accountingPeriodId) === periodId;
    })
    .sort((a, b) => {
      return Number(a.order) - Number(b.order) || byId(a, b);
    });
}

/** A legacy decimal as a whole number of hundredths or ten-thousandths (see scaled); null when empty. */
function scaledOrNull(
  value: unknown,
  places: number,
  unit: string,
  what: string,
): number | null {
  const written = text(value);

  return written === undefined ? null : scaled(written, places, unit, what);
}

/**
 * A legacy decimal ("38.000000") as a whole number of hundredths or
 * ten-thousandths (380000), read digit by digit so no float rounds it. One
 * with a nonzero digit past those places, or a sign, is refused.
 */
function scaled(
  written: string,
  places: number,
  unit: string,
  what: string,
): number {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(written);
  const whole = match?.[1];
  const fraction = match?.[2] ?? "";

  if (whole === undefined || /[1-9]/.test(fraction.slice(places))) {
    throw new Error(
      `${what} is ${written}, which is not a whole number of ${unit}`,
    );
  }

  return Number(whole + fraction.slice(0, places).padEnd(places, "0"));
}

function byId(a: Row, b: Row): number {
  return Number(a.id) - Number(b.id);
}

function projectEntries(
  db: Db,
  periodId: string,
  accountIds: Set<string>,
): JournalEntryData[] {
  const byTransaction = db.group("ledgerEntry", "ledgerTransactionId");

  return db
    .rows("ledgerTransaction")
    .filter((row) => {
      return String(row.accountingPeriodId) === periodId;
    })
    .sort((a, b) => {
      return Number(a.code) - Number(b.code);
    })
    .map((row) => {
      const kind = kindOf(row);
      const postings: PostingData[] = (byTransaction.get(String(row.id)) ?? [])
        .slice()
        .sort((a, b) => {
          return Number(a.order) - Number(b.order);
        })
        .map((line) => {
          const amount = eur(text(line.amount) ?? null).cents;
          const accountId = `la${must(text(line.postingAccountId), `the account of the posting ${String(line.id)}`)}`;

          if (!accountIds.has(accountId)) {
            throw new Error(
              `the posting ${String(line.id)} of the transaction ${String(row.id)} is on ${accountId}, which is not an account of the period ${periodId}`,
            );
          }

          const posting: PostingData = {
            accountId,
            debit: Math.max(amount, 0),
            credit: amount < 0 ? -amount : 0,
            counterpart: counterpartOf(line),
          };
          const item = text(line.installmentItemId);

          return kind === "collection" && amount < 0 && item !== undefined
            ? { ...posting, installmentItemId: `ii${item}` }
            : posting;
        });

      return {
        id: `tx${String(row.id)}`,
        periodId: `p${periodId}`,
        number: Number(row.code),
        at: romeTime(
          new Date(
            `${must(text(row.timestamp), `the timestamp of the transaction ${String(row.id)}`).replace(" ", "T")}Z`,
          ),
        ),
        kind,
        description: String(row.description ?? ""),
        postings,
        invoiceId: invoiceIdOf(row, kind),
      };
    });
}

function kindOf(row: Row): EntryKind {
  const type = text(row.type);

  if (type === undefined) {
    return "generic";
  }

  if (!Object.hasOwn(ENTRY_KIND_OF_TYPE, type)) {
    throw new Error(
      `the transaction ${String(row.id)} has the type ${type}, which the domain does not know`,
    );
  }

  return ENTRY_KIND_OF_TYPE[type] as EntryKind;
}

function counterpartOf(line: Row): Counterpart | null {
  const resident = text(line.unitResidentId);

  if (resident !== undefined) {
    return { kind: "owner", id: `r${resident}` };
  }

  const supplier = text(line.masterDataId);

  return supplier === undefined
    ? null
    : { kind: "supplier", id: `md${supplier}` };
}

/**
 * Every ledgerInvoice of the period, with the terms the domain computes its
 * postings from. The legacy percentages are percent decimals (22.00), a Rate
 * is hundredths of a percent (2200). The cost account is the one debit line of
 * the registration, the entry that names the invoice.
 */
function projectInvoices(
  db: Db,
  periodId: string,
  entries: JournalEntryData[],
): InvoiceData[] {
  const registrations = new Map<string, Row>();

  for (const row of db.rows("ledgerTransaction")) {
    const invoiceId = text(row.ledgerInvoiceId);

    if (
      String(row.accountingPeriodId) === periodId &&
      text(row.type) === "ledgerInvoiceRegistration" &&
      invoiceId !== undefined
    ) {
      registrations.set(invoiceId, row);
    }
  }

  return db
    .rows("ledgerInvoice")
    .filter((row) => {
      return String(row.accountingPeriodId) === periodId;
    })
    .sort((a, b) => {
      return Number(a.id) - Number(b.id);
    })
    .map((row) => {
      const id = String(row.id);
      const registration = must(
        registrations.get(id),
        `the registration of the invoice ${id}`,
      );
      const entryId = `tx${String(registration.id)}`;
      const debits = must(
        entries.find((entry) => {
          return entry.id === entryId;
        }),
        `the entry ${entryId}`,
      ).postings.filter((posting) => {
        return posting.debit > 0;
      });

      if (debits.length !== 1) {
        throw new Error(
          `the registration ${String(registration.id)} of the invoice ${id} has ${debits.length} debit lines`,
        );
      }

      const withholdingId = text(row.withholdingTaxId);

      return {
        id: `li${id}`,
        periodId: `p${periodId}`,
        entryId,
        supplierId: `md${String(row.masterDataId)}`,
        number: String(row.number),
        reason: text(row.description) ?? "",
        date: String(row.date),
        dueDate: text(row.expiryDate) ?? null,
        costAccountId: (debits[0] as PostingData).accountId,
        taxable: eur(text(row.taxableBase)).cents,
        socialSecurityRate: percent(row.welfareTaxPercentage),
        vatRate: percent(row.vatPercentage),
        nonTaxable: eur(text(row.totalTaxFreeAmount)).cents,
        withholdingCode:
          withholdingId === undefined
            ? null
            : withholdingCode(
                must(
                  db.by("withholdingTax", "id").get(withholdingId),
                  `the withholding tax ${withholdingId} of the invoice ${id}`,
                ),
              ),
        withholdingOnSocialSecurity:
          text(row.applyWithholdingTaxOnWelfareTax) === "1",
      };
    });
}

/** The period's withholding catalogue: each withholdingTax the period links to an account, by code. */
function projectWithholdingTaxes(
  db: Db,
  periodId: string,
): WithholdingTaxData[] {
  const taxes = db.by("withholdingTax", "id");

  return db
    .rows("withholdingTax2LA")
    .filter((link) => {
      return String(link.accountingPeriodId) === periodId;
    })
    .map((link) => {
      const taxId = String(link.withholdingTaxId);
      const tax = must(taxes.get(taxId), `the withholding tax ${taxId}`);

      return {
        periodId: `p${periodId}`,
        code: withholdingCode(tax),
        name: String(tax.name),
        rate: percent(tax.percentage),
        accountId: `la${String(link.ledgerAccountId)}`,
      };
    })
    .sort((a, b) => {
      return a.code.localeCompare(b.code);
    });
}

/** The period's installments, numbered by due date. */
function projectInstallments(db: Db, periodId: string): Installment[] {
  return installmentRowsOf(db, periodId).map((row, index) => {
    return {
      id: `in${String(row.id)}`,
      periodId: `p${periodId}`,
      number: index + 1,
      name: String(row.name),
      dueDate: dueDateOf(row),
      locked: row.locked === true,
    };
  });
}

/** What each resident owes on each of the period's installments, zero items too: installment by installment, each in id order. */
function projectInstallmentItems(
  db: Db,
  periodId: string,
): InstallmentItemData[] {
  const items = db.group("installmentItem", "installmentId");

  return installmentRowsOf(db, periodId).flatMap((installment) => {
    return (items.get(String(installment.id)) ?? [])
      .slice()
      .sort((a, b) => {
        return Number(a.id) - Number(b.id);
      })
      .map((row) => {
        const id = String(row.id);

        return {
          id: `ii${id}`,
          installmentId: `in${String(installment.id)}`,
          residentId: `r${must(text(row.unitResidentId), `the resident of the installment item ${id}`)}`,
          amount: eur(text(row.amount)).cents,
        };
      });
  });
}

/** The period's installment rows by due date, then id. */
function installmentRowsOf(db: Db, periodId: string): Row[] {
  return db
    .rows("installment")
    .filter((row) => {
      return String(row.accountingPeriodId) === periodId;
    })
    .sort((a, b) => {
      return (
        dueDateOf(a).localeCompare(dueDateOf(b)) || Number(a.id) - Number(b.id)
      );
    });
}

function dueDateOf(row: Row): string {
  return must(
    text(row.expiryDate),
    `the due date of the installment ${String(row.id)}`,
  ).slice(0, 10);
}

/** The building's suppliers, then the residencies (owners and tenants) that overlap the period, each in id order. */
function projectParties(db: Db, periodId: string): PartyData[] {
  const period = must(
    db.by("accountingPeriod", "id").get(periodId),
    `the period ${periodId}`,
  );
  const start = String(period.startDate).slice(0, 10);
  const end = String(period.endDate).slice(0, 10);

  const suppliers: PartyData[] = db
    .rows("condominiumSupplier")
    .filter((row) => {
      return String(row.condominiumId) === String(period.condominiumId);
    })
    .map((row) => {
      return String(row.masterDataId);
    })
    .sort(byNumber)
    .map((id) => {
      return { kind: "supplier", id: `md${id}`, name: masterDataName(db, id) };
    });

  const unitPeriods = db.group("unitPeriod", "unitId");
  const residents = db.group("unitResident", "unitPeriodId");
  const residentIds = db
    .rows("unit")
    .filter((unit) => {
      return (
        String(unit.accountingPeriodId) === periodId &&
        overlaps(unit, start, end)
      );
    })
    .flatMap((unit) => {
      return unitPeriods.get(String(unit.id)) ?? [];
    })
    .filter((unitPeriod) => {
      return overlaps(unitPeriod, start, end);
    })
    .flatMap((unitPeriod) => {
      return residents.get(String(unitPeriod.id)) ?? [];
    })
    .filter((resident) => {
      return overlaps(resident, start, end);
    })
    .map((resident) => {
      return String(resident.id);
    })
    .sort(byNumber);

  return [
    ...suppliers,
    ...residentIds.map((id) => {
      return ownerParty(db, id);
    }),
  ];
}

/** Whether a row's periodRestriction dates, either of them open, meet the period's. */
function overlaps(row: Row, start: string, end: string): boolean {
  const restriction = restrictionOf(row);

  return (
    restriction === null ||
    ((restriction.from === null || restriction.from <= end) &&
      (restriction.to === null || restriction.to >= start))
  );
}

function withholdingCode(tax: Row): string {
  return must(
    text(tax.code),
    `the code of the withholding tax ${String(tax.id)}`,
  );
}

/** A legacy percent decimal (22.00) as a Rate's hundredths of a percent (2200). */
function percent(value: unknown): number {
  return eur(text(value)).cents;
}

function byNumber(a: string, b: string): number {
  return Number(a) - Number(b);
}

/** The invoice a registration created or a payment pays. The dump links others too (a withholding payment); the domain names none on them. */
function invoiceIdOf(row: Row, kind: EntryKind): string | null {
  const id = text(row.ledgerInvoiceId);

  return id === undefined || (kind !== "invoice" && kind !== "invoicePayment")
    ? null
    : `li${id}`;
}

function ownerParty(db: Db, residentId: string): PartyData {
  const resident = must(
    db.by("unitResident", "id").get(residentId),
    `the resident ${residentId}`,
  );

  const unitPeriod = must(
    db.by("unitPeriod", "id").get(String(resident.unitPeriodId)),
    `the unit period of resident ${residentId}`,
  );

  const unit = must(
    db.by("unit", "id").get(String(unitPeriod.unitId)),
    `the unit of resident ${residentId}`,
  );
  const personId = String(resident.masterDataId);

  return {
    kind: "owner",
    id: `r${residentId}`,
    personId: `md${personId}`,
    name: masterDataName(db, personId),
    unitCode: must(
      text(unit.code),
      `the code of the unit ${String(unit.id)} of resident ${residentId}`,
    ),
    unitId: `u${String(unit.id)}`,
    startingBalance: eur(text(resident.startingBalance)).cents,
    role: roleOf(db, resident, unitPeriod),
    share: scaledOrNull(
      resident.percentage,
      4,
      "ten-thousandths",
      `the share of resident ${residentId}`,
    ),
    restriction: restrictionOf(resident) ?? restrictionOf(unit),
    ownRestriction: restrictionOf(resident),
  };
}

/** The role abbreviation the legacy app showed: the role of the resident's priority in its unit period's ownership scenario. */
function roleOf(db: Db, resident: Row, unitPeriod: Row): string {
  const role = db.rows("unitResidentRole").find((row) => {
    return (
      String(row.unitOwnershipScenarioId) ===
        String(unitPeriod.unitOwnershipScenarioId) &&
      String(row.unitResidentPriorityId) ===
        String(resident.unitResidentPriorityId)
    );
  });

  return must(
    text(role?.abbreviation),
    `the role of resident ${String(resident.id)}`,
  );
}

/** A row's periodRestriction dates, or null when both are open. */
function restrictionOf(row: Row): Restriction | null {
  const from = text(row.periodRestrictionStartDate)?.slice(0, 10) ?? null;
  const to = text(row.periodRestrictionEndDate)?.slice(0, 10) ?? null;

  return from === null && to === null ? null : { from, to };
}

function assignRole(
  roles: Map<string, AccountRole>,
  id: string,
  role: AccountRole,
): void {
  const held = roles.get(id);

  if (held !== undefined && held !== role) {
    throw new Error(`the account ${id} has two roles: ${held} and ${role}`);
  }

  roles.set(id, role);
}

/** A row's order; `what` names the row ("the account 105"). */
function orderOf(row: Row, what: string): number {
  const order = Number(must(text(row.order), `the order of ${what}`));

  if (!Number.isInteger(order)) {
    throw new Error(
      `${what} has the order ${String(row.order)}, which is not a whole number`,
    );
  }

  return order;
}

function natureOf(row: Row, id: string): AccountNature {
  const nature = String(row.kind);

  if (!isNature(nature)) {
    throw new Error(
      `the account ${id} has the nature ${nature}, which the domain does not know`,
    );
  }

  return nature;
}

function typeOf(row: Row, id: string): AccountType {
  const type = String(row.type);

  if (!isType(type)) {
    throw new Error(
      `the account ${id} has the type ${type}, which the domain does not know`,
    );
  }

  return type;
}

function isNature(value: string): value is AccountNature {
  return Object.hasOwn(NATURES, value);
}

function isType(value: string): value is AccountType {
  return Object.hasOwn(TYPES, value);
}

function text(value: unknown): string | undefined {
  return value === null || value === undefined || String(value).trim() === ""
    ? undefined
    : String(value).trim();
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`missing: ${what}`);
  }

  return value;
}
