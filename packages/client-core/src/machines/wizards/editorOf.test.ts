import { describe, expect, it } from "vitest";

import {
  cents,
  type EntryKind,
  type JournalEntry,
  type Posting,
} from "@cl/domain";
import { canEditEntry } from "@cl/domain/useCases/canEditEntry.ts";

import type { Books } from "#/presenters/booksPresenter.ts";
import { createAppHarness } from "#/testing/appHarness.ts";
import { createBooks } from "#/testing/createBooks.ts";
import { currentBooks, currentEntry } from "#/testing/harnessBooks.ts";

import type { WizardName } from "../journalDialogMachine.ts";
import { editorOf } from "./editorOf.ts";

describe("editorOf", () => {
  it.each([
    ["tx1", "genericEntry"],
    ["tx3", "directPaymentBank"],
    ["tx4", "multiCostPayment"],
    ["tx8", "directPaymentCash"],
    ["tx12", "withholdingPayment"],
  ] as const)("gives p1's %s the %s editor", (id, editor) => {
    const harness = createAppHarness();

    expect(editorOf(currentEntry(harness, id), currentBooks(harness))).toBe(
      editor,
    );
  });

  it("gives every kind the spec's editor on p1, and none to a kind that cannot be edited", () => {
    const harness = createAppHarness();
    const books = currentBooks(harness);

    expect(editorsByKind(books)).toEqual({
      openingBalances: ["genericEntry"],
      generic: ["genericEntry"],
      directPaymentBank: [
        "directPaymentBank",
        "multiCostPayment",
        "directPaymentBank",
        "directPaymentBank",
        "multiCostPayment",
      ],
      budgetAllocation: [null],
      collection: ["collection", "collection", "collection", "collection"],
      directPaymentCash: ["directPaymentCash"],
      invoice: ["invoice", "invoice"],
      invoicePayment: ["invoicePayment"],
      withholdingPayment: ["withholdingPayment"],
      closingBalances: [null],
    });
  });

  it("gives Pozzetto 2013's opening its own editor, and every invoice, payment and collection its own", () => {
    const harness = createAppHarness();

    harness.app.presenters.buildings.selectPeriod("p36");

    const books = currentBooks(harness);
    const editors = editorsByKind(books);

    expect(editorOf(currentEntry(harness, "tx100"), books)).toBe(
      "openingBalances",
    );
    expect(editors.invoice).toHaveLength(47);
    expect(new Set(editors.invoice)).toEqual(new Set(["invoice"]));
    expect(editors.invoicePayment).toHaveLength(43);
    expect(new Set(editors.invoicePayment)).toEqual(
      new Set(["invoicePayment"]),
    );
    expect(new Set(editors.generic)).toEqual(new Set(["genericEntry"]));
    expect(editors.collection).toHaveLength(36);
    expect(new Set(editors.collection)).toEqual(new Set(["collection"]));
  });

  it("a direct payment credited to another account than its role's opens in the generic editor", () => {
    const books = createBooks();

    expect(
      editorOf(
        createPayment("directPaymentCash", [
          createPosting("la21", 1000, 0),
          createPosting("la2", 0, 1000),
        ]),
        books,
      ),
    ).toBe("genericEntry");
    expect(
      editorOf(
        createPayment("directPaymentBank", [
          createPosting("la21", 1000, 0),
          createPosting("la1", 0, 1000),
        ]),
        books,
      ),
    ).toBe("genericEntry");
    expect(
      editorOf(
        createPayment("directPaymentCash", [
          createPosting("la21", 1000, 0),
          createPosting("la1", 0, 1000),
        ]),
        books,
      ),
    ).toBe("directPaymentCash");
  });

  it("a collection its wizard cannot write has no editor: a generic draft cannot carry items", () => {
    const harness = createAppHarness();
    const tx6 = currentEntry(harness, "tx6");

    expect(
      editorOf(
        { ...tx6, postings: tx6.postings.slice(1) },
        currentBooks(harness),
      ),
    ).toBeNull();
  });

  it.each(entryKinds())(
    "answers no editor for %s exactly when canEditEntry refuses it",
    (kind) => {
      const { entry, books } = createEntryOfKind(kind);

      expect(editorOf(entry, books) === null).toBe(!canEditEntry(entry).ok);
    },
  );
});

/** Every entry kind, the compiler holding the list to the type. */
function entryKinds(): EntryKind[] {
  return Object.keys({
    openingBalances: true,
    closingBalances: true,
    invoice: true,
    invoicePayment: true,
    collection: true,
    budgetAllocation: true,
    individualExpense: true,
    generic: true,
    directPaymentCash: true,
    directPaymentBank: true,
    withholdingPayment: true,
  } satisfies Record<EntryKind, true>) as EntryKind[];
}

/** Each kind's entries of the books, in journal order, as the editor each opens in. */
function editorsByKind(books: Books): Record<string, (WizardName | null)[]> {
  const editors: Record<string, (WizardName | null)[]> = {};

  for (const entry of books.entries) {
    editors[entry.kind] = [
      ...(editors[entry.kind] ?? []),
      editorOf(entry, books),
    ];
  }

  return editors;
}

interface EntryInBooks {
  entry: JournalEntry;
  books: Books;
}

/** An entry of the kind with no lines on the small books; for a collection, p1's tx6, since a collection with no lines is one its wizard cannot write. */
function createEntryOfKind(kind: EntryKind): EntryInBooks {
  if (kind === "collection") {
    const harness = createAppHarness();

    return {
      entry: currentEntry(harness, "tx6"),
      books: currentBooks(harness),
    };
  }

  return { entry: createPayment(kind, []), books: createBooks() };
}

function createPayment(kind: EntryKind, postings: Posting[]): JournalEntry {
  return {
    id: "e100",
    periodId: "p1",
    number: 100,
    at: "2013-04-01T10:00:00",
    kind,
    description: "Payment",
    postings,
    invoiceId: null,
  };
}

function createPosting(
  accountId: string,
  debit: number,
  credit: number,
): Posting {
  return {
    accountId,
    debit: cents(debit),
    credit: cents(credit),
    counterpart: null,
  };
}
