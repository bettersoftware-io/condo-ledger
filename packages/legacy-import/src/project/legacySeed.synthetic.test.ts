import { describe, expect, it } from "vitest";

import type {
  AccountData,
  AccountNature,
  AccountRole,
  AccountType,
  LegacySeedData,
  TableLink,
} from "@cl/domain";

import { buildDb } from "../db.ts";
import type { Row, Tables } from "../loadRows.ts";
import { ENTRY_KIND_OF_TYPE, projectLegacySeed } from "./legacySeed.ts";

describe("projectLegacySeed on a small synthetic dump", () => {
  it("projects the buildings, accounts, entries, parties, invoices, withholding taxes and installments of the balanced periods", () => {
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
          abbreviation: "Acqua CO",
          links: [
            {
              id: "el30",
              accountId: "la105",
              tableId: "dt20",
              use: "both",
              percentage: null,
              roles: { 1: null, 2: null, 3: 10000, 4: null },
              present: { 1: false, 2: false, 3: true, 4: false },
            },
          ],
        },
      ],
      entries: [
        {
          id: "tx200",
          periodId: "p10",
          number: 1,
          at: "2013-03-31T01:59:59",
          kind: "invoice",
          description: "Bolletta",
          postings: [
            { accountId: "la105", debit: 12000, credit: 0, counterpart: null },
            {
              accountId: "la103",
              debit: 0,
              credit: 11600,
              counterpart: { kind: "supplier", id: "md81" },
            },
            { accountId: "la106", debit: 0, credit: 400, counterpart: null },
          ],
          invoiceId: "li400",
        },
        {
          id: "tx201",
          periodId: "p10",
          number: 2,
          at: "2013-03-31T03:00:00",
          kind: "collection",
          description: "Rata",
          postings: [
            { accountId: "la102", debit: 5000, credit: 0, counterpart: null },
            {
              accountId: "la104",
              debit: 0,
              credit: 5000,
              counterpart: { kind: "owner", id: "r70" },
              installmentItemId: "ii600",
            },
          ],
          invoiceId: null,
        },
      ],
      parties: [
        {
          periodId: "p10",
          parties: [
            { kind: "supplier", id: "md81", name: "Acqua Srl" },
            {
              kind: "owner",
              id: "r70",
              personId: "md80",
              name: "Rossi Anna",
              unitCode: "A01",
              unitId: "u50",
              startingBalance: 1250,
              role: "PR",
              share: 1000000,
              restriction: null,
              ownRestriction: null,
            },
            {
              kind: "owner",
              id: "r72",
              personId: "md82",
              name: "Verdi Luca",
              unitCode: "A01",
              unitId: "u50",
              startingBalance: -300,
              role: "CO",
              share: null,
              restriction: { from: "2013-06-01", to: null },
              ownRestriction: { from: "2013-06-01", to: null },
            },
          ],
        },
      ],
      invoices: [
        {
          id: "li400",
          periodId: "p10",
          entryId: "tx200",
          supplierId: "md81",
          number: "7",
          reason: "Acqua",
          date: "2013-03-30",
          dueDate: "2013-04-30",
          costAccountId: "la105",
          taxable: 10000,
          socialSecurityRate: 0,
          vatRate: 2000,
          nonTaxable: 0,
          withholdingCode: "1019",
          withholdingOnSocialSecurity: false,
        },
      ],
      withholdingTaxes: [
        {
          periodId: "p10",
          code: "1019",
          name: "Società di persone",
          rate: 400,
          accountId: "la106",
        },
      ],
      installments: [
        {
          id: "in500",
          periodId: "p10",
          number: 1,
          name: "Rata 1",
          dueDate: "2013-03-20",
          locked: false,
        },
      ],
      installmentItems: [
        {
          id: "ii600",
          installmentId: "in500",
          residentId: "r70",
          amount: 5000,
        },
      ],
      units: [
        {
          id: "u50",
          periodId: "p10",
          code: "A01",
          groupId: "ug5",
          restriction: null,
        },
      ],
      unitGroups: [
        {
          id: "ug5",
          periodId: "p10",
          code: "A",
          name: "Scala A",
          parentId: null,
        },
      ],
      tables: [
        {
          id: "dt20",
          periodId: "p10",
          name: "Generale",
          order: 1,
          notes: "",
          restrictionGroupId: null,
        },
      ],
      coefficients: [{ tableId: "dt20", unitId: "u50", value: 380000 }],
    });
  });

  it("numbers a period's installments by due date, whatever their ids, and keeps a zero item", () => {
    const tables = createSmallDump();

    tables.installment?.push({
      id: "499",
      accountingPeriodId: "10",
      name: "Rata 2",
      expiryDate: "2013-06-20",
    });
    tables.installmentItem?.push({
      id: "601",
      installmentId: "499",
      unitResidentId: "72",
      amount: "0.00",
    });

    const seed = projectLegacySeed(buildDb(tables));

    expect([seed.installments, seed.installmentItems]).toEqual([
      [
        {
          id: "in500",
          periodId: "p10",
          number: 1,
          name: "Rata 1",
          dueDate: "2013-03-20",
          locked: false,
        },
        {
          id: "in499",
          periodId: "p10",
          number: 2,
          name: "Rata 2",
          dueDate: "2013-06-20",
          locked: false,
        },
      ],
      [
        {
          id: "ii600",
          installmentId: "in500",
          residentId: "r70",
          amount: 5000,
        },
        { id: "ii601", installmentId: "in499", residentId: "r72", amount: 0 },
      ],
    ]);
  });

  it("projects each resident's role from its priority and its unit period's scenario, its restriction (its own, else its unit's) and an installment's lock", () => {
    const tables = edit(createSmallDump(), "unit", "50", {
      periodRestrictionStartDate: "2013-02-01 00:00:00",
      periodRestrictionEndDate: "2013-11-30 00:00:00",
    });

    edit(tables, "installment", "500", { locked: true });

    const seed = projectLegacySeed(buildDb(tables));

    expect([
      seed.parties[0]?.parties.flatMap((party) => {
        return party.kind === "owner"
          ? [[party.id, party.role, party.restriction]]
          : [];
      }),
      seed.installments.map((installment) => {
        return [installment.id, installment.locked];
      }),
    ]).toEqual([
      [
        ["r70", "PR", { from: "2013-02-01", to: "2013-11-30" }],
        ["r72", "CO", { from: "2013-06-01", to: null }],
      ],
      [["in500", true]],
    ]);
  });

  it("reads the role in the unit period's own scenario", () => {
    const tables = edit(createSmallDump(), "unitPeriod", "60", {
      unitOwnershipScenarioId: "2",
    });

    edit(tables, "unitResident", "72", { unitResidentPriorityId: "1" });

    expect(
      projectLegacySeed(buildDb(tables)).parties[0]?.parties.flatMap(
        (party) => {
          return party.kind === "owner" ? [party.role] : [];
        },
      ),
    ).toEqual(["NP", "NP"]);
  });

  it("names an item only on a collection's owner credit, whatever item the dump links to another line", () => {
    const tables = edit(createSmallDump(), "ledgerEntry", "302", {
      installmentItemId: "600",
    });

    edit(tables, "ledgerEntry", "301", { installmentItemId: "600" });

    expect(
      projectLegacySeed(buildDb(tables)).entries.flatMap((entry) => {
        return entry.postings.map((posting) => {
          return posting.installmentItemId ?? null;
        });
      }),
    ).toEqual([null, null, null, null, "ii600"]);
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

  it("names an invoice only on a registration or a payment, whatever invoice the dump links to another kind", () => {
    const tables = edit(createSmallDump(), "ledgerTransaction", "201", {
      ledgerInvoiceId: "400",
    });
    const entries = projectLegacySeed(buildDb(tables)).entries;

    edit(tables, "ledgerTransaction", "201", {
      type: "ledgerInvoicePayment",
    });

    expect(
      [entries, projectLegacySeed(buildDb(tables)).entries].map((list) => {
        return list[1]?.invoiceId;
      }),
    ).toEqual([null, "li400"]);
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
      invoices: [],
      withholdingTaxes: [],
      installments: [],
      installmentItems: [],
      units: [],
      unitGroups: [],
      tables: [],
      coefficients: [],
    });
  });

  it("carries an invoice's non-taxable amount, social security and withholding on it, and an invoice with no due date or withholding", () => {
    const tables = edit(createSmallDump(), "ledgerInvoice", "400", {
      expiryDate: null,
      description: null,
      totalTaxFreeAmount: "2.50",
      welfareTaxPercentage: "4.00",
      vatPercentage: null,
      withholdingTaxId: null,
      applyWithholdingTaxOnWelfareTax: "1",
    });

    expect(projectLegacySeed(buildDb(tables)).invoices[0]).toMatchObject({
      reason: "",
      dueDate: null,
      nonTaxable: 250,
      socialSecurityRate: 400,
      vatRate: 0,
      withholdingCode: null,
      withholdingOnSocialSecurity: true,
    });
  });
});

describe("projectLegacySeed's allocation data", () => {
  it("projects a period's tables by their order, each coefficient in ten-thousandths, and a table's restriction to a group", () => {
    const tables = edit(createSmallDump(), "distributionTable", "20", {
      order: "2",
      restrictionUnitGroupId: "5",
      notes: "Per millesimi",
    });

    tables.distributionTable?.push({
      id: "19",
      accountingPeriodId: "10",
      name: "Scale",
      order: "1",
      restrictionUnitGroupId: null,
      notes: null,
    });
    tables.distributionTableItem?.push({
      distributionTableId: "19",
      unitId: "50",
      coefficient: "0.999000",
    });

    const seed = projectLegacySeed(buildDb(tables));

    expect([seed.tables, seed.coefficients]).toEqual([
      [
        {
          id: "dt19",
          periodId: "p10",
          name: "Scale",
          order: 1,
          notes: "",
          restrictionGroupId: null,
        },
        {
          id: "dt20",
          periodId: "p10",
          name: "Generale",
          order: 2,
          notes: "Per millesimi",
          restrictionGroupId: "ug5",
        },
      ],
      [
        { tableId: "dt19", unitId: "u50", value: 9990 },
        { tableId: "dt20", unitId: "u50", value: 380000 },
      ],
    ]);
  });

  it.each([
    [null, "both"],
    ["estimate", "budget"],
    ["currentBalance", "finalBalance"],
  ])("projects a link of type %j as use %j", (type, use) => {
    const tables = edit(createSmallDump(), "expenseLA2Table", "30", { type });

    expect(linksOf(projectLegacySeed(buildDb(tables)))[0]?.use).toBe(use);
  });

  it("keeps a role row with an empty percentage apart from a missing row, and reads a link's percentage in hundredths", () => {
    const tables = edit(createSmallDump(), "expenseLA2Table", "30", {
      percentage: "50.00",
    });

    tables.expenseLA2Role?.push({
      expenseLA2TableId: "30",
      unitResidentPriorityId: "1",
      percentage: null,
    });

    expect(linksOf(projectLegacySeed(buildDb(tables)))).toEqual([
      {
        id: "el30",
        accountId: "la105",
        tableId: "dt20",
        use: "both",
        percentage: 5000,
        roles: { 1: null, 2: null, 3: 10000, 4: null },
        present: { 1: true, 2: false, 3: true, 4: false },
      },
    ]);
  });

  it("keeps a resident's own dates as ownRestriction, while restriction falls back to its unit's", () => {
    const tables = edit(createSmallDump(), "unit", "50", {
      periodRestrictionStartDate: "2013-02-01 00:00:00",
      periodRestrictionEndDate: null,
    });

    expect(
      projectLegacySeed(buildDb(tables)).parties[0]?.parties.flatMap(
        (party) => {
          return party.kind === "owner"
            ? [[party.id, party.restriction, party.ownRestriction]]
            : [];
        },
      ),
    ).toEqual([
      ["r70", { from: "2013-02-01", to: null }, null],
      [
        "r72",
        { from: "2013-06-01", to: null },
        { from: "2013-06-01", to: null },
      ],
    ]);
  });

  it("gives the account a stored budget allocation credits the role budgetAllocation, and not the owners' or roundings accounts it credits too", () => {
    const tables = edit(createSmallDump(), "accountingPeriod", "10", {
      flatResidentRoundingOffLedgerAccountId: "109",
    });

    tables.ledgerAccount?.push(
      account("108", null, "Da riparto preventivo", "regular", "income", "3"),
      account("109", "100", "Arrotondamenti", "regular", "assets", "6"),
    );
    tables.ledgerTransaction?.push({
      id: "202",
      accountingPeriodId: "10",
      code: "3",
      timestamp: "2013-04-01 08:00:00",
      type: "estimateDistribution",
      ledgerInvoiceId: null,
      description: "Riparto preventivo",
    });
    tables.ledgerEntry?.push(
      entry("305", "202", "104", "305.01", "1", { unitResidentId: "70" }),
      entry("306", "202", "104", "-5.00", "2", { unitResidentId: "72" }),
      entry("307", "202", "109", "-0.01", "3", { unitResidentId: "70" }),
      entry("308", "202", "108", "-300.00", "4", {}),
    );

    expect(
      projectLegacySeed(buildDb(tables)).accounts.flatMap((projected) => {
        return projected.role === null ? [] : [[projected.id, projected.role]];
      }),
    ).toEqual([
      ["la101", "cash"],
      ["la102", "bank"],
      ["la103", "suppliers"],
      ["la104", "owners"],
      ["la107", "tax"],
      ["la106", "tax"],
      ["la108", "budgetAllocation"],
      ["la109", "roundings"],
    ]);
  });
});

describe("projectLegacySeed refuses what it cannot project, naming the id", () => {
  it("refuses a unit with two unit periods in a seeded period", () => {
    const tables = createSmallDump();

    tables.unitPeriod?.push({
      id: "61",
      unitId: "50",
      unitOwnershipScenarioId: "2",
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow("the unit 50 has 2 unit periods; the allocation reads only one");
  });

  it("refuses a coefficient that is not a whole number of ten-thousandths", () => {
    const tables = createSmallDump();

    tables.distributionTableItem = [
      { distributionTableId: "20", unitId: "50", coefficient: "38.000050" },
    ];

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow(
      "the coefficient of the unit 50 in the table 20 is 38.000050, which is not a whole number of ten-thousandths",
    );
  });

  it("refuses a role priority the domain does not know", () => {
    const tables = createSmallDump();

    tables.expenseLA2Role?.push({
      expenseLA2TableId: "30",
      unitResidentPriorityId: "5",
      percentage: "10.00",
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow(
      "the link 30 has a role of priority 5, which the domain does not know",
    );
  });

  it("refuses a share that is not a plain decimal", () => {
    const tables = edit(createSmallDump(), "unitResident", "70", {
      percentage: "-50.000000",
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow(
      "the share of resident 70 is -50.000000, which is not a whole number of ten-thousandths",
    );
  });

  it("refuses a link type the domain does not know", () => {
    const tables = edit(createSmallDump(), "expenseLA2Table", "30", {
      type: "forecast",
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow(
      "the link 30 has the type forecast, which the domain does not know",
    );
  });

  it("refuses a transaction without a timestamp", () => {
    const tables = edit(createSmallDump(), "ledgerTransaction", "201", {
      timestamp: null,
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow("missing: the timestamp of the transaction 201");
  });

  it("refuses a transaction type the domain does not know", () => {
    const tables = edit(createSmallDump(), "ledgerTransaction", "201", {
      type: "giroconto",
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow(
      "the transaction 201 has the type giroconto, which the domain does not know",
    );
  });

  it("refuses a transaction type named like a member of Object.prototype", () => {
    const tables = edit(createSmallDump(), "ledgerTransaction", "201", {
      type: "constructor",
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow(
      "the transaction 201 has the type constructor, which the domain does not know",
    );
  });

  it("maps every legacy transaction type to a kind", () => {
    const kinds = Object.entries(ENTRY_KIND_OF_TYPE).map(([type, kind]) => {
      const tables = edit(createSmallDump(), "ledgerTransaction", "201", {
        type,
      });

      return projectLegacySeed(buildDb(tables)).entries[1]?.kind === kind;
    });

    expect(kinds).toHaveLength(10);
    expect(kinds.every(Boolean)).toBe(true);
  });

  it("refuses an installment without a due date", () => {
    const tables = edit(createSmallDump(), "installment", "500", {
      expiryDate: null,
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow("missing: the due date of the installment 500");
  });

  it("refuses an installment item without a resident", () => {
    const tables = edit(createSmallDump(), "installmentItem", "600", {
      unitResidentId: null,
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow("missing: the resident of the installment item 600");
  });

  it("refuses a resident whose priority has no role in its unit period's scenario", () => {
    const tables = edit(createSmallDump(), "unitResident", "72", {
      unitResidentPriorityId: "4",
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow("missing: the role of resident 72");
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

  it("refuses an invoice no registration names", () => {
    const tables = edit(createSmallDump(), "ledgerTransaction", "200", {
      ledgerInvoiceId: null,
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow("missing: the registration of the invoice 400");
  });

  it("refuses a registration whose cost is not on exactly one debit line", () => {
    const tables = edit(createSmallDump(), "ledgerEntry", "302", {
      ledgerTransactionId: "200",
    });

    edit(tables, "ledgerEntry", "303", { ledgerTransactionId: "200" });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow("the registration 200 of the invoice 400 has 2 debit lines");
  });

  it("refuses an invoice whose withholding tax the dump does not have", () => {
    const tables = edit(createSmallDump(), "ledgerInvoice", "400", {
      withholdingTaxId: "9",
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow("missing: the withholding tax 9 of the invoice 400");
  });

  it("refuses a withholding tax without a code", () => {
    const tables = edit(createSmallDump(), "withholdingTax", "3", {
      code: null,
    });

    expect(() => {
      return projectLegacySeed(buildDb(tables));
    }).toThrow("missing: the code of the withholding tax 3");
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
 * at the root; one supplier of the building and one of another; in unit
 * A01 an owner, a tenant and a resident who left before the period. Two
 * balanced transactions, one second either side of the switch to summer time
 * (2013-03-31 01:00 UTC): the registration of an invoice withholding 4%
 * (code 1019 on the tax account), and an owner's collection that pays the
 * owner's item of the period's one installment, and an installment of
 * another period. For the allocation: A01 in group A, the owner's 100%
 * share, one table (A01 at 38) and the cost account's link to it, 100% on the
 * tenants' role (priority 3); and a group, a unit and a table of another
 * period.
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
    unitGroup: [
      {
        id: "5",
        accountingPeriodId: "10",
        parentUnitGroupId: null,
        code: "A",
        name: "Scala A",
      },
      {
        id: "6",
        accountingPeriodId: "11",
        parentUnitGroupId: null,
        code: "B",
        name: "Box",
      },
    ],
    unit: [
      { id: "50", accountingPeriodId: "10", code: "A01", unitGroupId: "5" },
      { id: "51", accountingPeriodId: "11", code: "A01", unitGroupId: "6" },
    ],
    unitPeriod: [{ id: "60", unitId: "50", unitOwnershipScenarioId: "1" }],
    unitResidentRole: [
      {
        unitOwnershipScenarioId: "1",
        unitResidentPriorityId: "1",
        abbreviation: "PR",
      },
      {
        unitOwnershipScenarioId: "1",
        unitResidentPriorityId: "3",
        abbreviation: "CO",
      },
      {
        unitOwnershipScenarioId: "2",
        unitResidentPriorityId: "1",
        abbreviation: "NP",
      },
    ],
    unitResident: [
      resident("70", "80", "1", "12.50", { percentage: "100.000000" }),
      resident("71", "83", "1", "0.00", {
        periodRestrictionEndDate: "2012-12-31",
      }),
      resident("72", "82", "3", "-3.00", {
        periodRestrictionStartDate: "2013-06-01",
      }),
    ],
    person: [
      { masterDataId: "80", lastName: "Rossi", firstName: "Anna" },
      { masterDataId: "82", lastName: "Verdi", firstName: "Luca" },
      { masterDataId: "83", lastName: "Neri", firstName: "Ugo" },
    ],
    company: [
      { masterDataId: "81", name: "Acqua Srl" },
      { masterDataId: "84", name: "Gas Spa" },
    ],
    condominiumSupplier: [
      { condominiumId: "2", masterDataId: "84" },
      { condominiumId: "1", masterDataId: "81" },
    ],
    ledgerAccount: [
      account("100", null, "Totale", "grouping", "assetsOrLiabilities", "1"),
      account("101", "100", "Cassa", "regular", "assets", "1"),
      account("102", "100", "Banca", "regular", "assets", "2"),
      account("103", "100", "Fornitori", "control", "liabilities", "3"),
      account("104", "100", "Condomini", "controlUnitResident", "assets", "4"),
      account("107", "100", "Erario", "grouping", "liabilities", "5"),
      account("106", "107", "Ritenute", "regular", "liabilities", "1"),
      {
        ...account("105", null, "Acqua", "regular", "expenses", "2"),
        abbreviation: "Acqua CO",
      },
    ],
    expenseLedgerAccount: [{ ledgerAccountId: "105", estimate: "300.00" }],
    distributionTable: [
      {
        id: "20",
        accountingPeriodId: "10",
        name: "Generale",
        order: "1",
        restrictionUnitGroupId: null,
        notes: null,
      },
      {
        id: "21",
        accountingPeriodId: "11",
        name: "Generale",
        order: "1",
        restrictionUnitGroupId: null,
        notes: null,
      },
    ],
    distributionTableItem: [
      { distributionTableId: "20", unitId: "50", coefficient: "38.000000" },
      { distributionTableId: "21", unitId: "51", coefficient: "1.000000" },
    ],
    expenseLA2Table: [
      {
        id: "30",
        expenseLedgerAccountId: "105",
        distributionTableId: "20",
        type: null,
        percentage: null,
      },
    ],
    expenseLA2Role: [
      {
        expenseLA2TableId: "30",
        unitResidentPriorityId: "3",
        percentage: "100.00",
      },
    ],
    withholdingTax: [
      {
        id: "3",
        code: "1019",
        name: "Società di persone",
        percentage: "4.00",
      },
      {
        id: "4",
        code: "1020",
        name: "Società di capitali",
        percentage: "4.00",
      },
    ],
    withholdingTax2LA: [
      {
        withholdingTaxId: "3",
        ledgerAccountId: "106",
        accountingPeriodId: "10",
      },
      {
        withholdingTaxId: "4",
        ledgerAccountId: "906",
        accountingPeriodId: "11",
      },
    ],
    ledgerInvoice: [
      {
        id: "400",
        accountingPeriodId: "10",
        masterDataId: "81",
        number: "7",
        description: "Acqua",
        date: "2013-03-30",
        expiryDate: "2013-04-30",
        taxableBase: "100.00",
        totalTaxFreeAmount: null,
        welfareTaxPercentage: "0.00",
        vatPercentage: "20.00",
        withholdingTaxId: "3",
        applyWithholdingTaxOnWelfareTax: "0",
      },
    ],
    installment: [
      {
        id: "500",
        accountingPeriodId: "10",
        name: "Rata 1",
        expiryDate: "2013-03-20",
      },
      {
        id: "510",
        accountingPeriodId: "11",
        name: "Rata 1",
        expiryDate: "2014-03-20",
      },
    ],
    installmentItem: [
      {
        id: "600",
        installmentId: "500",
        unitResidentId: "70",
        amount: "50.00",
      },
      { id: "610", installmentId: "510", unitResidentId: "70", amount: "9.00" },
    ],
    ledgerTransaction: [
      {
        id: "201",
        accountingPeriodId: "10",
        code: "2",
        timestamp: "2013-03-31 01:00:00",
        type: "unitResidentTakings",
        ledgerInvoiceId: null,
        description: "Rata",
      },
      {
        id: "200",
        accountingPeriodId: "10",
        code: "1",
        timestamp: "2013-03-31 00:59:59",
        type: "ledgerInvoiceRegistration",
        ledgerInvoiceId: "400",
        description: "Bolletta",
      },
    ],
    ledgerEntry: [
      entry("301", "200", "103", "-116.00", "2", { masterDataId: "81" }),
      entry("300", "200", "105", "120.00", "1", {}),
      entry("304", "200", "106", "-4.00", "3", {}),
      entry("302", "201", "102", "50.00", "1", {}),
      entry("303", "201", "104", "-50.00", "2", {
        unitResidentId: "70",
        installmentItemId: "600",
      }),
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

function linksOf(seed: LegacySeedData): TableLink[] {
  return seed.accounts.flatMap((projected) => {
    return projected.links;
  });
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
    abbreviation: null,
    links: [],
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

function resident(
  id: string,
  person: string,
  priority: string,
  startingBalance: string,
  restriction: Row,
): Row {
  return {
    id,
    unitPeriodId: "60",
    masterDataId: person,
    unitResidentPriorityId: priority,
    periodRestrictionStartDate: null,
    periodRestrictionEndDate: null,
    percentage: null,
    startingBalance,
    ...restriction,
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
    installmentItemId: null,
    ...counterpart,
  };
}
