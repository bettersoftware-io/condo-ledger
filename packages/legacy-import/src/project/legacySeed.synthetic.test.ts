import { describe, expect, it } from "vitest";

import type {
  AccountData,
  AccountNature,
  AccountRole,
  AccountType,
} from "@cl/domain";

import { buildDb } from "../db.ts";
import type { Row, Tables } from "../loadRows.ts";
import { projectLegacySeed } from "./legacySeed.ts";

describe("projectLegacySeed on a small synthetic dump", () => {
  it("projects the buildings, accounts, entries and parties of the balanced periods", () => {
    expect(projectLegacySeed(buildDb(createSmallDump()))).toEqual({
      buildings: [
        {
          id: "c1",
          name: "Alfa",
          periods: [
            {
              id: "p10",
              name: "2013",
              type: "ordinary",
              start: "2013-01-01",
              end: "2013-12-31",
              closed: false,
            },
          ],
        },
      ],
      accounts: [
        seedAccount(
          "la100",
          null,
          "Totale",
          1,
          "assetsOrLiabilities",
          "grouping",
          null,
        ),
        seedAccount("la101", "la100", "Cassa", 1, "assets", "regular", "cash"),
        seedAccount("la102", "la100", "Banca", 2, "assets", "regular", "bank"),
        seedAccount(
          "la103",
          "la100",
          "Fornitori",
          3,
          "liabilities",
          "control",
          "suppliers",
        ),
        seedAccount(
          "la104",
          "la100",
          "Condomini",
          4,
          "assets",
          "controlUnitResident",
          "owners",
        ),
        seedAccount(
          "la107",
          "la100",
          "Erario",
          5,
          "liabilities",
          "grouping",
          "tax",
        ),
        seedAccount(
          "la106",
          "la107",
          "Ritenute",
          1,
          "liabilities",
          "regular",
          "tax",
        ),
        {
          ...seedAccount(
            "la105",
            null,
            "Acqua",
            2,
            "expenses",
            "regular",
            null,
          ),
          budget: 30000,
        },
      ],
      entries: [
        {
          id: "tx200",
          periodId: "p10",
          number: 1,
          at: "2013-03-31T01:59:59",
          description: "Bolletta",
          postings: [
            { accountId: "la105", debit: 12000, credit: 0, counterpart: null },
            {
              accountId: "la103",
              debit: 0,
              credit: 12000,
              counterpart: { kind: "supplier", id: "md81" },
            },
          ],
        },
        {
          id: "tx201",
          periodId: "p10",
          number: 2,
          at: "2013-03-31T03:00:00",
          description: "Rata",
          postings: [
            { accountId: "la102", debit: 5000, credit: 0, counterpart: null },
            {
              accountId: "la104",
              debit: 0,
              credit: 5000,
              counterpart: { kind: "owner", id: "r70" },
            },
          ],
        },
      ],
      parties: [
        { kind: "supplier", id: "md81", name: "Acqua Srl" },
        {
          kind: "owner",
          id: "r70",
          personId: "md80",
          name: "Rossi Anna",
          unitCode: "A01",
        },
      ],
    });
  });

  it("gives Rome time either side of the switch to summer time: +1h before, +2h after", () => {
    const tables = edit(createSmallDump(), "ledgerTransaction", "200", {
      timestamp: "2013-01-10 14:59:29",
    });

    edit(tables, "ledgerTransaction", "201", {
      timestamp: "2013-07-01 15:05:51",
    });

    expect(
      projectLegacySeed(buildDb(tables)).entries.map((entry) => {
        return entry.at;
      }),
    ).toEqual(["2013-01-10T15:59:29", "2013-07-01T17:05:51"]);
  });

  it("leaves out a building whose only period's books do not balance", () => {
    const tables = edit(createSmallDump(), "ledgerEntry", "303", {
      amount: "-49.98",
    });

    expect(projectLegacySeed(buildDb(tables))).toEqual({
      buildings: [],
      accounts: [],
      entries: [],
      parties: [],
    });
  });
});

describe("projectLegacySeed refuses what it cannot project, naming the id", () => {
  it("refuses a transaction without a timestamp", () => {
    const tables = edit(createSmallDump(), "ledgerTransaction", "201", {
      timestamp: null,
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow("missing: the timestamp of the transaction 201");
  });

  it("refuses an owner whose unit has no code", () => {
    const tables = edit(createSmallDump(), "unit", "50", { code: " " });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow("missing: the code of the unit 50 of resident 70");
  });

  it("refuses an account without an order", () => {
    const tables = edit(createSmallDump(), "ledgerAccount", "105", {
      order: null,
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow("missing: the order of the account 105");
  });

  it("refuses an account whose order is not a whole number", () => {
    const tables = edit(createSmallDump(), "ledgerAccount", "105", {
      order: "2.5",
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow(
      "the account 105 has the order 2.5, which is not a whole number",
    );
  });

  it("refuses an account whose parent is not an account of its period", () => {
    const tables = edit(createSmallDump(), "ledgerAccount", "105", {
      parentLedgerAccountId: "900",
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow(
      "the account 105 has the parent 900, which is not an account of the period 10",
    );
  });

  it("refuses an account that two role columns name", () => {
    const tables = edit(createSmallDump(), "accountingPeriod", "10", {
      flatResidentRoundingOffLedgerAccountId: "102",
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow("the account 102 has two roles: bank and roundings");
  });

  it("refuses a withholding-tax account that a role column already names", () => {
    const tables = edit(createSmallDump(), "accountingPeriod", "10", {
      defaultCheckingAccountLedgerAccountId: "106",
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow("the account 106 has two roles: bank and tax");
  });

  it("refuses a posting on an account outside its period", () => {
    const tables = edit(createSmallDump(), "ledgerEntry", "302", {
      postingAccountId: "900",
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow(
      "the posting 302 of the transaction 201 is on la900, which is not an account of the period 10",
    );
  });

  it("refuses a posting without an account", () => {
    const tables = edit(createSmallDump(), "ledgerEntry", "302", {
      postingAccountId: null,
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow("missing: the account of the posting 302");
  });

  it("refuses an account nature the domain does not know", () => {
    const tables = edit(createSmallDump(), "ledgerAccount", "105", {
      kind: "costs",
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow(
      "the account 105 has the nature costs, which the domain does not know",
    );
  });

  it("refuses an account type the domain does not know", () => {
    const tables = edit(createSmallDump(), "ledgerAccount", "105", {
      type: "leaf",
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow(
      "the account 105 has the type leaf, which the domain does not know",
    );
  });
});

/**
 * One building, one period of books (p10) and the rows they lean on: a root
 * grouping over cash, bank, the suppliers and owners control accounts and a
 * withholding-tax account under its own grouping; one budgeted cost account
 * at the root; one supplier, one owner in unit A01. Two balanced transactions,
 * one second either side of the switch to summer time (2013-03-31 01:00 UTC).
 */
function createSmallDump(): Tables {
  return {
    condominium: [{ id: "1", name: "Alfa", code: "A", type: "regular" }],
    accountingPeriod: [
      {
        id: "10",
        condominiumId: "1",
        name: "2013",
        type: "regular",
        status: "open",
        startDate: "2013-01-01",
        endDate: "2013-12-31",
        paymentInCashLedgerAccountId: "101",
        defaultCheckingAccountLedgerAccountId: "102",
        supplierAccountsPayableLedgerAccountId: "103",
        flatResidentAccountsReceivableLedgerAccountId: "104",
        flatResidentRoundingOffLedgerAccountId: null,
      },
    ],
    unit: [{ id: "50", accountingPeriodId: "10", code: "A01" }],
    unitPeriod: [{ id: "60", unitId: "50" }],
    unitResident: [{ id: "70", unitPeriodId: "60", masterDataId: "80" }],
    person: [{ masterDataId: "80", lastName: "Rossi", firstName: "Anna" }],
    company: [{ masterDataId: "81", name: "Acqua Srl" }],
    ledgerAccount: [
      account("100", null, "Totale", "grouping", "assetsOrLiabilities", "1"),
      account("101", "100", "Cassa", "regular", "assets", "1"),
      account("102", "100", "Banca", "regular", "assets", "2"),
      account("103", "100", "Fornitori", "control", "liabilities", "3"),
      account("104", "100", "Condomini", "controlUnitResident", "assets", "4"),
      account("107", "100", "Erario", "grouping", "liabilities", "5"),
      account("106", "107", "Ritenute", "regular", "liabilities", "1"),
      account("105", null, "Acqua", "regular", "expenses", "2"),
    ],
    expenseLedgerAccount: [{ ledgerAccountId: "105", estimate: "300.00" }],
    withholdingTax2LA: [{ ledgerAccountId: "106" }],
    ledgerTransaction: [
      {
        id: "201",
        accountingPeriodId: "10",
        code: "2",
        timestamp: "2013-03-31 01:00:00",
        description: "Rata",
      },
      {
        id: "200",
        accountingPeriodId: "10",
        code: "1",
        timestamp: "2013-03-31 00:59:59",
        description: "Bolletta",
      },
    ],
    ledgerEntry: [
      entry("301", "200", "103", "-120.00", "2", { masterDataId: "81" }),
      entry("300", "200", "105", "120.00", "1", {}),
      entry("302", "201", "102", "50.00", "1", {}),
      entry("303", "201", "104", "-50.00", "2", { unitResidentId: "70" }),
    ],
  };
}

/** The tables with one row's columns changed. */
function edit(tables: Tables, table: string, id: string, changes: Row): Tables {
  const rows = tables[table] ?? [];
  const index = rows.findIndex((row) => {
    return row.id === id;
  });

  if (index === -1) {
    throw new Error(`no row ${id} in ${table}`);
  }

  rows[index] = { ...rows[index], ...changes };

  return tables;
}

function seedAccount(
  id: string,
  parentId: string | null,
  name: string,
  order: number,
  nature: AccountNature,
  type: AccountType,
  role: AccountRole | null,
): AccountData {
  return {
    id,
    periodId: "p10",
    parentId,
    name,
    order,
    nature,
    type,
    role,
    budget: null,
  };
}

function account(
  id: string,
  parent: string | null,
  name: string,
  type: string,
  kind: string,
  order: string,
): Row {
  return {
    id,
    accountingPeriodId: "10",
    parentLedgerAccountId: parent,
    name,
    type,
    kind,
    order,
  };
}

function entry(
  id: string,
  transaction: string,
  postingAccount: string,
  amount: string,
  order: string,
  counterpart: Row,
): Row {
  return {
    id,
    ledgerTransactionId: transaction,
    postingAccountId: postingAccount,
    amount,
    order,
    unitResidentId: null,
    masterDataId: null,
    ...counterpart,
  };
}
