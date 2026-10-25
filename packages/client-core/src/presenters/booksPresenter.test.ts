import { BehaviorSubject } from "rxjs";
import { describe, expect, it } from "vitest";

import {
  type Building,
  cents,
  createAccountsSimulator,
  createInstallmentsSimulator,
  createJournalSimulator,
  type EntryDraft,
  fixedClock,
  type Invoice,
  type JournalEntry,
  type LegacySeed,
  loadLegacySeed,
  rate,
  type WithholdingTax,
} from "@cl/domain";
import { legacySeedData } from "@cl/domain/simulators/seed/legacySeed.generated.ts";
import { createTwoPeriodSeed } from "@cl/domain/testing/createTwoPeriodSeed.ts";

import {
  type Books,
  type BooksPresenterPorts,
  createBooksPresenter,
} from "./booksPresenter.ts";
import type { PeriodSelection } from "./buildingsPresenter.ts";

describe("the books presenter", () => {
  it("reads the selected period's accounts, parties, entries and tree together", () => {
    const { latest } = createPresented({ buildingId: "c1", periodId: "p1" });

    expect(latest()?.periodId).toBe("p1");
    expect(latest()?.accounts).toHaveLength(13);
    expect(latest()?.entries.map(numberOf)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(latest()?.tree.debit).toBe(212619);
  });

  it("switches to another period's books, and to null with no selection", () => {
    const { selected$, latest } = createPresented({
      buildingId: "c1",
      periodId: "p1",
    });

    selected$.next({ buildingId: "c1", periodId: "p2" });
    expect(latest()?.periodId).toBe("p2");
    expect(latest()?.entries.map(idOf)).toEqual(["x-e1"]);

    selected$.next(null);
    expect(latest()).toBeNull();
  });

  it("carries the period's invoices, withholding catalogue and dates, and switches with the period", () => {
    const { selected$, latest } = createPresented(
      { buildingId: "c19", periodId: "p36" },
      loadLegacySeed(legacySeedData),
    );

    expect(latest()?.invoices).toHaveLength(47);
    expect(
      latest()?.withholdingTaxes.map((tax) => {
        return `${tax.code}:${tax.accountId}`;
      }),
    ).toEqual(["1004:la166", "1019:la167", "1020:la168", "1040:la165"]);
    expect(latest()?.period).toEqual({
      start: "2013-01-01",
      end: "2013-12-31",
    });

    selected$.next({ buildingId: "c1", periodId: "p1" });

    expect(latest()?.invoices).toHaveLength(2);
    expect(
      latest()?.invoices.every((invoice) => {
        return invoice.periodId === "p1";
      }),
    ).toBe(true);
    expect(latest()?.withholdingTaxes.map(accountOf)).toEqual([
      "la24",
      "la25",
      "la26",
      "la23",
    ]);
    expect(latest()?.period).toEqual({
      start: "2011-01-01",
      end: "2011-12-31",
    });
  });

  it("carries the period's installments and their items, and switches with the period", () => {
    const { selected$, latest } = createPresented(
      { buildingId: "c19", periodId: "p36" },
      loadLegacySeed(legacySeedData),
    );

    expect(latest()?.installments).toHaveLength(12);
    expect(latest()?.installmentItems).toHaveLength(324);
    expect(
      latest()?.installments.every((installment) => {
        return installment.periodId === "p36";
      }),
    ).toBe(true);

    selected$.next({ buildingId: "c1", periodId: "p1" });

    expect(
      latest()?.installments.every((installment) => {
        return installment.periodId === "p1";
      }),
    ).toBe(true);
    expect(latest()?.installments).not.toHaveLength(12);
  });

  it("answers null for a period the building tree does not hold yet, and the books once it does", () => {
    const seed = createTwoPeriodSeed();
    const { tree$, latest } = createPresented(
      { buildingId: "c1", periodId: "p1" },
      seed,
      [],
    );

    expect(latest()).toBeNull();

    tree$.next(seed.buildings);

    expect(latest()?.periodId).toBe("p1");
    expect(latest()?.period).toEqual({
      start: "2013-01-01",
      end: "2013-12-31",
    });
  });

  it("does not read the books again when the tree emits the same period anew", () => {
    const seed = createTwoPeriodSeed();
    const { tree$, emitted } = createPresented(
      { buildingId: "c1", periodId: "p1" },
      seed,
    );
    const before = emitted();

    tree$.next(structuredClone(seed.buildings));

    expect(emitted()).toBe(before);
  });

  it("never hands out an invoice beside entries that do not hold its registration, across a registration added and deleted", async () => {
    const { ports, emissions, latest } = createPresented({
      buildingId: "c1",
      periodId: "p1",
    });

    const added = await ports.journal.addEntry("p1", createRegistration());
    const id = added.ok ? added.value.id : "";

    expect(latest()?.invoices.map(entryIdOf)).toEqual([id]);

    expect(await ports.journal.deleteEntry(id)).toEqual({ ok: true });
    expect(latest()?.invoices).toEqual([]);
    expect(emissions().filter(isInconsistent)).toEqual([]);
  });

  it("waits for the invoice an entry names before handing the books out", () => {
    const seed = createTwoPeriodSeed();
    const named: LegacySeed = {
      ...seed,
      entries: seed.entries.map((entry) => {
        return entry.id === "e2" || entry.id === "e3"
          ? { ...entry, invoiceId: "li2" }
          : entry;
      }),
    };
    const invoices$ = new BehaviorSubject<Invoice[]>([]);
    const journal = createJournalSimulator(
      named,
      fixedClock("2026-10-14T08:00:00Z"),
    );

    const presenter = createBooksPresenter(
      {
        accounts: createAccountsSimulator(named),
        journal: {
          ...journal,
          invoices: () => {
            return invoices$;
          },
        },
        installments: createInstallmentsSimulator(named),
      },
      new BehaviorSubject<PeriodSelection | null>({
        buildingId: "c1",
        periodId: "p1",
      }),
      new BehaviorSubject<Building[]>(named.buildings),
    );
    const seen: (Books | null)[] = [];

    presenter.books$.subscribe((next) => {
      seen.push(next);
    });
    invoices$.next([createInvoice("li2", "e2")]);

    expect(seen.map(invoiceIdsOf)).toEqual([null, ["li2"]]);
  });

  it("emits again when the journal changes", async () => {
    const { ports, latest } = createPresented({
      buildingId: "c1",
      periodId: "p1",
    });

    await ports.journal.deleteEntry("e6");

    expect(latest()?.entries).toHaveLength(8);
    expect(latest()?.tree.debit).toBe(212618);
  });
});

interface Presented {
  selected$: BehaviorSubject<PeriodSelection | null>;
  tree$: BehaviorSubject<Building[]>;
  ports: BooksPresenterPorts;
  latest: () => Books | null;
  /** How many times books$ has emitted. */
  emitted: () => number;
  /** Every non-null books$ emitted, in order. */
  emissions: () => Books[];
}

function createPresented(
  initial: PeriodSelection | null,
  seed: LegacySeed = createTwoPeriodSeed(),
  tree: Building[] = seed.buildings,
): Presented {
  const selected$ = new BehaviorSubject<PeriodSelection | null>(initial);
  const tree$ = new BehaviorSubject<Building[]>(tree);
  const ports: BooksPresenterPorts = {
    accounts: createAccountsSimulator(seed),
    journal: createJournalSimulator(seed, fixedClock("2026-10-14T08:00:00Z")),
    installments: createInstallmentsSimulator(seed),
  };
  const presenter = createBooksPresenter(ports, selected$, tree$);
  let latest: Books | null = null;
  let emitted = 0;
  const emissions: Books[] = [];

  presenter.books$.subscribe((next) => {
    latest = next;
    emitted += 1;

    if (next !== null) {
      emissions.push(next);
    }
  });

  return {
    selected$,
    tree$,
    ports,
    latest: () => {
      return latest;
    },
    emitted: () => {
      return emitted;
    },
    emissions: () => {
      return emissions;
    },
  };
}

/** Supplier md1's invoice on the two-period seed's p1: taxable 100.00, VAT 20%, 20% withheld on la7. */
function createRegistration(): EntryDraft {
  return {
    kind: "invoice",
    description: "Invoice 7",
    postings: [
      {
        accountId: "la21",
        debit: cents(12000),
        credit: cents(0),
        counterpart: null,
      },
      {
        accountId: "la4",
        debit: cents(0),
        credit: cents(10000),
        counterpart: { kind: "supplier", id: "md1" },
      },
      {
        accountId: "la7",
        debit: cents(0),
        credit: cents(2000),
        counterpart: null,
      },
    ],
    invoice: {
      supplierId: "md1",
      number: "7",
      reason: "Ascensore",
      date: "2013-04-23",
      dueDate: null,
      costAccountId: "la21",
      taxable: cents(10000),
      socialSecurityRate: rate(0),
      vatRate: rate(2000),
      nonTaxable: cents(0),
      withholdingCode: "1040",
      withholdingOnSocialSecurity: false,
    },
  };
}

/** An invoice whose registration the entries do not hold, or an entry naming an invoice the invoices do not hold. */
function isInconsistent(books: Books): boolean {
  const entryIds = new Set(books.entries.map(idOf));
  const invoiceIds = new Set(
    books.invoices.map((invoice) => {
      return invoice.id;
    }),
  );

  return (
    books.invoices.some((invoice) => {
      return !entryIds.has(invoice.entryId);
    }) ||
    books.entries.some((entry) => {
      return entry.invoiceId !== null && !invoiceIds.has(entry.invoiceId);
    })
  );
}

function createInvoice(id: string, entryId: string): Invoice {
  const terms = createRegistration().invoice;

  if (terms === undefined) {
    throw new Error("missing: the registration's terms");
  }

  return { ...terms, id, periodId: "p1", entryId };
}

function invoiceIdsOf(books: Books | null): string[] | null {
  return (
    books?.invoices.map((invoice) => {
      return invoice.id;
    }) ?? null
  );
}

function entryIdOf(invoice: Invoice): string {
  return invoice.entryId;
}

function numberOf(entry: JournalEntry): number {
  return entry.number;
}

function idOf(entry: JournalEntry): string {
  return entry.id;
}

function accountOf(tax: WithholdingTax): string {
  return tax.accountId;
}
