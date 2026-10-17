import { describe, expect, it } from "vitest";

import type { OwnerParty, Party } from "#/entities/party.ts";
import { must } from "#/support/must.ts";
import { invoicePostings } from "#/useCases/invoice.ts";
import { openInvoices } from "#/useCases/openInvoices.ts";

import { legacySeedData } from "./legacySeed.generated.ts";
import { loadLegacySeed } from "./legacySeed.ts";

describe("the seed's invoices", () => {
  it.each([
    ["p36", 47],
    ["p1", 2],
  ])(
    "in %s, %i invoices whose postings are their registration's",
    (periodId, count) => {
      const invoices = seed.invoices.filter((invoice) => {
        return invoice.periodId === periodId;
      });

      expect(invoices).toHaveLength(count);

      for (const invoice of invoices) {
        const registration = must(
          seed.entries.find((entry) => {
            return entry.id === invoice.entryId;
          }),
          `the registration ${invoice.entryId}`,
        );

        expect(registration.kind).toBe("invoice");
        expect(
          invoicePostings(invoice, seed.withholdingTaxes, seed.accounts),
        ).toEqual({ ok: true, value: registration.postings });
      }
    },
  );

  it.each(["p36", "p1"])(
    "in %s, every registration and payment names an invoice of the period",
    (periodId) => {
      const ids = new Set(
        seed.invoices
          .filter((invoice) => {
            return invoice.periodId === periodId;
          })
          .map((invoice) => {
            return invoice.id;
          }),
      );

      const named = seed.entries.filter((entry) => {
        return (
          entry.periodId === periodId &&
          (entry.kind === "invoice" || entry.kind === "invoicePayment")
        );
      });

      expect(named.length).toBeGreaterThan(0);

      for (const entry of named) {
        expect(
          ids.has(must(entry.invoiceId, `the invoice of ${entry.id}`)),
        ).toBe(true);
      }
    },
  );

  it("names an invoice on no entry but a registration or a payment", () => {
    expect(
      seed.entries
        .filter((entry) => {
          return (
            entry.kind !== "invoice" &&
            entry.kind !== "invoicePayment" &&
            entry.invoiceId !== null
          );
        })
        .map((entry) => {
          return `${entry.id}:${entry.kind}:${String(entry.invoiceId)}`;
        }),
    ).toEqual([]);
  });

  it("leaves Pozzetto 2013 with the eight invoices the dump leaves unsettled", () => {
    expect(
      openInvoices(
        seed.invoices.filter((invoice) => {
          return invoice.periodId === "p36";
        }),
        seed.entries.filter((entry) => {
          return entry.periodId === "p36";
        }),
        seed.withholdingTaxes,
      ),
    ).toHaveLength(8);
  });
});

describe("the seed's withholding catalogue", () => {
  it("maps Pozzetto 2013's four codes to their accounts, 1004 at no rate", () => {
    const catalogue = seed.withholdingTaxes.filter((tax) => {
      return tax.periodId === "p36";
    });

    expect(
      catalogue.map((tax) => {
        return [tax.code, tax.accountId];
      }),
    ).toEqual([
      ["1004", "la166"],
      ["1019", "la167"],
      ["1020", "la168"],
      ["1040", "la165"],
    ]);
    expect(
      catalogue.find((tax) => {
        return tax.code === "1004";
      })?.rate,
    ).toBe(0);
  });
});

describe("the seed's parties", () => {
  it("gives Pozzetto 2013 its 27 residents and its building's 12 suppliers", () => {
    const parties = partiesOf("p36");

    expect(owners(parties)).toHaveLength(27);
    expect(
      parties.filter((party) => {
        return party.kind === "supplier";
      }),
    ).toHaveLength(12);
  });

  it("gives Saturno 2011 its 10 residents, the tenants r3 and r7 among them", () => {
    const ids = owners(partiesOf("p1")).map((party) => {
      return party.id;
    });

    // r3 and r7 are the legacy tenants (unitResidentPriority 3, the CO role); a party does not carry the role.
    expect(ids).toHaveLength(10);
    expect(ids).toEqual(expect.arrayContaining(["r3", "r7"]));
  });

  it("names among a period's parties every counterpart its postings name", () => {
    for (const entry of seed.entries) {
      const ids = new Set(
        partiesOf(entry.periodId).map((party) => {
          return `${party.kind}:${party.id}`;
        }),
      );

      for (const posting of entry.postings) {
        if (posting.counterpart !== null) {
          expect(
            ids.has(`${posting.counterpart.kind}:${posting.counterpart.id}`),
          ).toBe(true);
        }
      }
    }
  });

  it("opens Pozzetto 2013 with each resident's starting balance and the bank", () => {
    const opening = must(
      seed.entries.find((entry) => {
        return entry.periodId === "p36" && entry.kind === "openingBalances";
      }),
      "the opening entry of p36",
    );

    const lines = Object.fromEntries(
      opening.postings
        .filter((posting) => {
          return posting.counterpart?.kind === "owner";
        })
        .map((posting) => {
          return [
            must(posting.counterpart, "a counterpart").id,
            posting.debit - posting.credit,
          ];
        }),
    );

    // Every resident who starts the period owing or in credit, and no other, has a line of that amount.
    const balances = Object.fromEntries(
      owners(partiesOf("p36"))
        .filter((party) => {
          return party.startingBalance !== 0;
        })
        .map((party) => {
          return [party.id, party.startingBalance];
        }),
    );

    const others = opening.postings.filter((posting) => {
      return posting.counterpart?.kind !== "owner";
    });

    expect(Object.keys(lines).length).toBeGreaterThan(0);
    expect(lines).toEqual(balances);
    expect(others).toEqual([
      { accountId: "la156", debit: 625099, credit: 0, counterpart: null },
    ]);
  });
});

function partiesOf(periodId: string): Party[] {
  return must(
    seed.parties.find((list) => {
      return list.periodId === periodId;
    }),
    `the parties of ${periodId}`,
  ).parties;
}

function owners(parties: Party[]): OwnerParty[] {
  return parties.filter((party) => {
    return party.kind === "owner";
  });
}

const seed = loadLegacySeed(legacySeedData);
