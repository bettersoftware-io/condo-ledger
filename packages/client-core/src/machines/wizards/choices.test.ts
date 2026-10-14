import { describe, expect, it } from "vitest";

import { createSmallBooks } from "@cl/domain/testing/createSmallBooks.ts";

import { createAccountsWithTax, createBooks } from "#/testing/createBooks.ts";

import {
  isExpenseLeaf,
  leafChoices,
  roleAccount,
  rowChoices,
  shortPath,
} from "./choices.ts";

describe("the wizards' choices", () => {
  it("the expense leaves are the regular cost accounts, by path, grouped under their top-level account", () => {
    expect(leafChoices(createBooks(), isExpenseLeaf)).toEqual([
      {
        key: "la21",
        label: "Costs › Spese generali › Ascensore",
        group: "Spese generali",
      },
      {
        key: "la22",
        label: "Costs › Spese generali › Pulizie",
        group: "Spese generali",
      },
    ]);
  });

  it("a grouping with nothing under it is not a leaf to pick", () => {
    const books = createBooks([
      ...createSmallBooks().accounts,
      {
        id: "la40",
        periodId: "p1",
        parentId: null,
        name: "Straordinarie",
        order: 40,
        nature: "expenses",
        type: "grouping",
        role: null,
        budget: null,
      },
    ]);

    expect(
      leafChoices(books, isExpenseLeaf).map((choice) => {
        return choice.key;
      }),
    ).toEqual(["la21", "la22"]);
  });

  it("a leaf with no account above it is its own group, and the leaves come in tree order", () => {
    const choices = leafChoices(createBooks(), () => {
      return true;
    });

    expect(
      choices.map((choice) => {
        return [choice.key, choice.group];
      }),
    ).toEqual([
      ["la1", "Liquidità"],
      ["la2", "Liquidità"],
      ["la3", "Fondi"],
      ["la21", "Spese generali"],
      ["la22", "Spese generali"],
      ["la30", "Da condòmini"],
    ]);
  });

  it("the rows that own postings, every one in tree order, a control account's per party", () => {
    const choices = rowChoices(createBooks());

    expect(
      choices.map((choice) => {
        return [choice.key, choice.group];
      }),
    ).toEqual([
      ["la1", "Liquidità"],
      ["la2", "Liquidità"],
      ["la4@assets/md2", "Fornitori"],
      ["la5@assets/md10/r1", "Condòmini"],
      ["la5@assets/md10/r2", "Condòmini"],
      ["la6@assets/md10/r1", "Arrotondamenti"],
      ["la3", "Fondi"],
      ["la4@liabilities/md1", "Fornitori"],
      ["la5@liabilities/md11/r3", "Condòmini"],
      ["la21", "Spese generali"],
      ["la22", "Spese generali"],
      ["la23/md10/r2", "Spese individuali"],
      ["la30", "Da condòmini"],
    ]);
    expect(choices[7]?.label).toBe(
      "Patrimonial › (Liabilities) › Fornitori › Alfa s.n.c.",
    );
    expect(choices[11]?.label).toBe(
      "Costs › Spese individuali › Rossi Mario › A02",
    );
  });

  it("the account with a role is the regular one, or none", () => {
    expect(roleAccount(createBooks(), "bank")?.id).toBe("la2");
    expect(roleAccount(createBooks(), "tax")).toBeNull();
    expect(roleAccount(createBooks(createAccountsWithTax()), "tax")?.id).toBe(
      "la25",
    );
  });

  it("a short path leaves Total out", () => {
    expect(shortPath(createBooks(), "la1")).toBe(
      "Patrimonial › (Assets) › Liquidità › Cassa",
    );
  });
});
