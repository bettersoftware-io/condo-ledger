import { describe, expect, it } from "vitest";

import type { Account, AccountType } from "../entities/account.ts";
import { cents, ZERO_CENTS } from "../entities/cents.ts";
import { legacySeedData } from "../simulators/seed/legacySeed.generated.ts";
import { loadLegacySeed } from "../simulators/seed/legacySeed.ts";
import { createSmallBooks } from "../testing/createSmallBooks.ts";
import {
  type AccountNode,
  buildAccountTree,
  findNode,
  ROOT_KEY,
} from "./accountTree.ts";

describe("buildAccountTree", () => {
  it("roots the tree at Total with the five levels in the report's order", () => {
    const root = build();

    expect(root.key).toBe(ROOT_KEY);
    expect(root.label).toBe("Total");
    expect(root.children.map(keyOf)).toEqual([
      "patrimonial",
      "costs",
      "revenue",
    ]);
    expect(must("patrimonial").children.map(keyOf)).toEqual([
      "assets",
      "liabilities",
    ]);
  });

  it("sums gross debit and credit up every level, and balance is debit minus credit", () => {
    const root = build();

    expect([root.debit, root.credit, root.balance]).toEqual([
      212619, 212619, 0,
    ]);
    expect(must("la10")).toMatchObject({
      debit: 35100,
      credit: 20001,
      balance: 15099,
    });
    expect(must("costs")).toMatchObject({
      debit: 57518,
      credit: 0,
      balance: 57518,
    });
    expect(must("revenue")).toMatchObject({
      debit: 0,
      credit: 100100,
      balance: -100100,
    });
  });

  it("places pure-nature accounts first, then the control accounts, in legacy order on each side", () => {
    expect(must("assets").children.map(keyOf)).toEqual([
      "la10",
      "la4@assets",
      "la5@assets",
      "la6@assets",
    ]);
    expect(must("liabilities").children.map(keyOf)).toEqual([
      "la3",
      "la4@liabilities",
      "la5@liabilities",
    ]);
  });

  it("orders the accounts at each level by their legacy order, not by the order they come in", () => {
    const books = createSmallBooks();
    const root = buildAccountTree(
      books.accounts.slice().reverse(),
      books.entries,
      books.parties,
    );

    expect(findNode(root, "assets")?.children.map(keyOf)).toEqual([
      "la10",
      "la4@assets",
      "la5@assets",
      "la6@assets",
    ]);
    expect(findNode(root, "la10")?.children.map(keyOf)).toEqual(["la1", "la2"]);
    expect(findNode(root, "la20")?.children.map(keyOf)).toEqual([
      "la21",
      "la22",
    ]);
  });

  it("splits a supplier control account per supplier by the sign of each balance; zero goes to assets", () => {
    const assets = must("la4@assets");
    const liabilities = must("la4@liabilities");

    expect(assets.children.map(keyOf)).toEqual(["la4@assets/md2"]);
    expect(assets.children[0]).toMatchObject({
      label: "Beta S.p.A.",
      debit: 20000,
      credit: 20000,
      balance: 0,
    });
    expect(assets.children[0]?.scope).toEqual({
      kind: "supplier",
      accountId: "la4",
      supplierId: "md2",
    });
    expect(liabilities.children.map(keyOf)).toEqual(["la4@liabilities/md1"]);
    expect(liabilities.children[0]).toMatchObject({
      label: "Alfa s.n.c.",
      debit: 0,
      credit: 36018,
      balance: -36018,
    });
  });

  it("omits a side that has no row", () => {
    expect(must("la6@assets").children.map(keyOf)).toEqual(["la6@assets/md10"]);
    expect(findNode(build(), "la6@liabilities")).toBeUndefined();
  });

  it("groups an owner control account per person, then per residency, sides by the person's sum", () => {
    const rossi = must("la5@assets/md10");

    expect(rossi.label).toBe("Rossi Mario");
    expect(
      rossi.children.map((node) => {
        return [node.key, node.label, node.balance];
      }),
    ).toEqual([
      ["la5@assets/md10/r1", "A01", 60000],
      ["la5@assets/md10/r2", "A02", 8500],
    ]);
    expect(rossi.balance).toBe(68500);
    expect(must("la5@liabilities").children.map(keyOf)).toEqual([
      "la5@liabilities/md11",
    ]);
    expect(must("la5@liabilities/md11").balance).toBe(-5000);
  });

  it("groups individual expenses per person under costs, with no sides", () => {
    expect(must("costs").children.map(keyOf)).toEqual(["la20", "la23"]);
    expect(must("la23").children.map(keyOf)).toEqual(["la23/md10"]);
    expect(must("la23/md10/r2")).toMatchObject({ label: "A02", debit: 1500 });
  });

  it("rolls budgets up from the leaves and leaves null where no leaf has one", () => {
    expect(must("la20").budget).toBe(150000);
    expect(must("costs").budget).toBe(150000);
    expect(must("la23").budget).toBeNull();
    expect(must("assets").budget).toBeNull();
  });

  it("picks the icon from the role, else folder for a node with children, else document", () => {
    expect(must("la1").icon).toBe("cash");
    expect(must("la2").icon).toBe("bank");
    expect(must("la4@assets").icon).toBe("suppliers");
    expect(must("la5@assets").icon).toBe("owners");
    expect(must("la6@assets").icon).toBe("roundings");
    expect(must("la10").icon).toBe("folder");
    expect(must("la21").icon).toBe("document");
    expect(must("patrimonial").icon).toBe("folder");
  });

  it("draws the revenue a budget allocation credits as any other account: a document for a leaf", () => {
    const books = createSmallBooks();
    const accounts = books.accounts.map((account) => {
      return account.id === "la21"
        ? { ...account, role: "budgetAllocation" as const }
        : account;
    });

    expect(
      findNode(buildAccountTree(accounts, books.entries, books.parties), "la21")
        ?.icon,
    ).toBe("document");
  });

  it.each([["liquidity" as const], ["funds" as const]])(
    "draws a %s account as any other account: a folder for a node with children",
    (role) => {
      const books = createSmallBooks();
      const accounts = books.accounts.map((account) => {
        return account.id === "la10" ? { ...account, role } : account;
      });

      expect(
        findNode(
          buildAccountTree(accounts, books.entries, books.parties),
          "la10",
        )?.icon,
      ).toBe("folder");
    },
  );

  it("gives a plain leaf an account scope and a node with children none", () => {
    expect(must("la21").scope).toEqual({ kind: "account", accountId: "la21" });
    expect(must("la20").scope).toBeNull();
    expect(must("la5@assets/md10/r1").scope).toEqual({
      kind: "residency",
      accountId: "la5",
      residentId: "r1",
    });
  });

  it("counts a zero posting as zero", () => {
    expect(must("la1")).toMatchObject({
      debit: 35100,
      credit: 1,
      balance: 35099,
    });
    expect(must("la2")).toMatchObject({
      debit: 0,
      credit: 20000,
      balance: -20000,
    });
  });

  it("throws, naming the id, for a posting whose counterpart is not a party", () => {
    const books = createSmallBooks();
    books.entries[0]?.postings.push({
      accountId: "la4",
      debit: 0 as never,
      credit: 0 as never,
      counterpart: { kind: "supplier", id: "md99" },
    });

    expect(() => {
      return buildAccountTree(books.accounts, books.entries, books.parties);
    }).toThrow("missing: the supplier md99");
  });

  it("throws for a posting on an account the period does not have", () => {
    const books = createSmallBooks();
    books.entries[0]?.postings.push({
      accountId: "la77",
      debit: 0 as never,
      credit: 0 as never,
      counterpart: null,
    });

    expect(() => {
      return buildAccountTree(books.accounts, books.entries, books.parties);
    }).toThrow("missing: the account la77");
  });

  it("throws, naming the control account, when a control account has a child account", () => {
    const books = createSmallBooks();
    books.accounts.push({
      ...createControlAccount("la7", "control"),
      parentId: "la4",
    });

    expect(() => {
      return buildAccountTree(books.accounts, books.entries, books.parties);
    }).toThrow("a control account has child accounts: la4");
  });

  it("throws, naming the account, for a posting on an account that has child accounts", () => {
    const books = createSmallBooks();
    books.entries[0]?.postings.push({
      accountId: "la10",
      debit: cents(777),
      credit: ZERO_CENTS,
      counterpart: null,
    });

    expect(() => {
      return buildAccountTree(books.accounts, books.entries, books.parties);
    }).toThrow("an account with child accounts has postings: la10");
  });

  it("builds every period of the generated seed: no account with child accounts has a posting", () => {
    const seed = loadLegacySeed(legacySeedData);
    const periodIds = seed.buildings.flatMap((building) => {
      return building.periods.map((period) => {
        return period.id;
      });
    });

    expect(periodIds).toHaveLength(2);

    for (const periodId of periodIds) {
      const tree = buildAccountTree(
        seed.accounts.filter((account) => {
          return account.periodId === periodId;
        }),
        seed.entries.filter((entry) => {
          return entry.periodId === periodId;
        }),
        seed.parties.find((list) => {
          return list.periodId === periodId;
        })?.parties ?? [],
      );

      expect(tree.key).toBe(ROOT_KEY);
    }
  });

  it("throws, naming the parent, for an account whose parent the period does not have", () => {
    const books = createSmallBooks();
    books.accounts.push({
      ...createControlAccount("la7", "control"),
      parentId: "la99",
    });

    expect(() => {
      return buildAccountTree(books.accounts, books.entries, books.parties);
    }).toThrow("missing: the account la99");
  });

  it("puts a control account's posting with no counterpart in a (no counterpart) row", () => {
    const books = createSmallBooks();
    books.entries[0]?.postings.push(
      {
        accountId: "la4",
        debit: cents(500),
        credit: ZERO_CENTS,
        counterpart: null,
      },
      {
        accountId: "la5",
        debit: ZERO_CENTS,
        credit: cents(700),
        counterpart: null,
      },
    );
    const root = buildAccountTree(books.accounts, books.entries, books.parties);

    expect(findNode(root, "la4@assets/none")).toMatchObject({
      label: "(no counterpart)",
      balance: 500,
      scope: { kind: "supplier", accountId: "la4", supplierId: "none" },
    });
    expect(findNode(root, "la5@liabilities/none")?.label).toBe(
      "(no counterpart)",
    );
    expect(findNode(root, "la5@liabilities/none/none")).toMatchObject({
      label: "(no counterpart)",
      balance: -700,
      scope: { kind: "residency", accountId: "la5", residentId: "none" },
    });
  });

  it("shows a control account with no postings once, on the assets side, at zero and with no rows", () => {
    const books = createSmallBooks();
    books.accounts.push(
      createControlAccount("la7", "control"),
      createControlAccount("la8", "controlUnitResident"),
    );
    const root = buildAccountTree(books.accounts, books.entries, books.parties);

    expect(findNode(root, "la7@assets")).toMatchObject({
      debit: 0,
      credit: 0,
      balance: 0,
      children: [],
    });
    expect(findNode(root, "la8@assets")).toMatchObject({
      debit: 0,
      credit: 0,
      balance: 0,
      children: [],
    });
    expect(
      ["la7@liabilities", "la8@liabilities"].map((key) => {
        return findNode(root, key);
      }),
    ).toEqual([undefined, undefined]);
  });

  it("keeps an empty assets side for a control account whose rows all have a credit balance", () => {
    const books = createSmallBooks();
    books.accounts.push(createControlAccount("la7", "control"));
    books.entries[0]?.postings.push({
      accountId: "la7",
      debit: ZERO_CENTS,
      credit: cents(300),
      counterpart: { kind: "supplier", id: "md1" },
    });
    const root = buildAccountTree(books.accounts, books.entries, books.parties);

    expect(findNode(root, "la7@assets")).toMatchObject({
      debit: 0,
      credit: 0,
      balance: 0,
      children: [],
    });
    expect(findNode(root, "la7@liabilities")).toMatchObject({
      balance: -300,
      children: [expect.objectContaining({ key: "la7@liabilities/md1" })],
    });
  });

  it("splits a fixed-nature control account under a grouping per supplier, with no side", () => {
    const books = createSmallBooks();
    const grouping: Account = {
      ...createControlAccount("la8", "grouping"),
      name: "Debiti",
      order: 8,
      nature: "liabilities",
    };

    const suppliers: Account = {
      ...createControlAccount("la9", "control"),
      parentId: "la8",
      name: "Fornitori (passivi)",
      order: 9,
      nature: "liabilities",
      role: "suppliers",
    };
    books.accounts.push(grouping, suppliers);
    books.entries[0]?.postings.push(
      {
        accountId: "la9",
        debit: cents(500),
        credit: ZERO_CENTS,
        counterpart: { kind: "supplier", id: "md1" },
      },
      {
        accountId: "la9",
        debit: ZERO_CENTS,
        credit: cents(800),
        counterpart: { kind: "supplier", id: "md2" },
      },
    );
    const root = buildAccountTree(books.accounts, books.entries, books.parties);

    expect(findNode(root, "la9")?.children.map(keyOf)).toEqual([
      "la9/md1",
      "la9/md2",
    ]);
    expect(findNode(root, "la9/md1")?.balance).toBe(500);
    expect(findNode(root, "la9/md2")?.balance).toBe(-800);
    expect(findNode(root, "la8")).toMatchObject({
      debit: 500,
      credit: 800,
      balance: -300,
      children: [expect.objectContaining({ key: "la9" })],
    });
    expect(findNode(root, "la9@assets")).toBeUndefined();
    expect(findNode(root, "la9@liabilities")).toBeUndefined();
    expect(findNode(root, "la4@assets")?.children.map(keyOf)).toEqual([
      "la4@assets/md2",
    ]);
    expect(findNode(root, "la4@liabilities")?.children.map(keyOf)).toEqual([
      "la4@liabilities/md1",
    ]);
  });

  it("splits a fixed-nature control account at the top of its side per supplier, with no side", () => {
    const books = createSmallBooks();
    books.accounts.push({
      ...createControlAccount("la7", "control"),
      nature: "liabilities",
    });
    books.entries[0]?.postings.push({
      accountId: "la7",
      debit: ZERO_CENTS,
      credit: cents(800),
      counterpart: { kind: "supplier", id: "md2" },
    });
    const root = buildAccountTree(books.accounts, books.entries, books.parties);

    expect(findNode(root, "liabilities")?.children.map(keyOf)).toContain("la7");
    expect(findNode(root, "la7")?.children.map(keyOf)).toEqual(["la7/md2"]);
    expect(findNode(root, "la7/md2")?.balance).toBe(-800);
  });

  it("splits an individual-expenses control account under a grouping per person, then per residency", () => {
    const books = createSmallBooks();
    const grouping: Account = {
      ...createControlAccount("la25", "grouping"),
      name: "Spese individuali",
      order: 25,
      nature: "expenses",
    };
    books.accounts = books.accounts.map((account) => {
      return account.id === "la23" ? { ...account, parentId: "la25" } : account;
    });
    books.accounts.push(grouping);
    const root = buildAccountTree(books.accounts, books.entries, books.parties);

    expect(findNode(root, "costs")?.children.map(keyOf)).toEqual([
      "la20",
      "la25",
    ]);
    expect(findNode(root, "la25")?.children.map(keyOf)).toEqual(["la23"]);
    expect(findNode(root, "la23")?.children.map(keyOf)).toEqual(["la23/md10"]);
    expect(findNode(root, "la23/md10/r2")).toMatchObject({
      label: "A02",
      debit: 1500,
      scope: { kind: "residency", accountId: "la23", residentId: "r2" },
    });
    expect(findNode(root, "la25")).toMatchObject({
      debit: 1500,
      balance: 1500,
      budget: null,
      scope: null,
    });
  });
});

function createControlAccount(id: string, type: AccountType): Account {
  return {
    id,
    periodId: "p1",
    parentId: null,
    name: `Conto ${id}`,
    order: 7,
    nature: "assetsOrLiabilities",
    type,
    role: null,
    budget: null,
    abbreviation: null,
    links: [],
  };
}

function build(): AccountNode {
  const books = createSmallBooks();
  return buildAccountTree(books.accounts, books.entries, books.parties);
}

function must(key: string): AccountNode {
  const node = findNode(build(), key);

  if (node === undefined) {
    throw new Error(`no node ${key}`);
  }

  return node;
}

function keyOf(node: AccountNode): string {
  return node.key;
}
