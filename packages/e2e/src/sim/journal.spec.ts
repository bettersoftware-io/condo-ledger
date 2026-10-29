import { expect, test } from "#/testing/test.ts";

test.describe("deleting a journal entry, on the simulator", () => {
  test("asks first, and keeps the entry when the answer is no", async ({
    shell,
    journal,
  }) => {
    await shell.open();
    await shell.openScreen("Journal & Daybook");
    await expect.poll(journal.entryCount).toBe(18);

    expect(await journal.askToDelete(ENTRY)).toBe(
      `Delete the entry "${ENTRY}"?`,
    );

    await journal.answer(false);

    expect(await journal.entryCount()).toBe(18);
    expect(await journal.descriptions()).toContain(ENTRY);
  });

  test("removes the entry, and its amount from the accounts' total, when the answer is yes", async ({
    shell,
    journal,
    accounts,
  }) => {
    await shell.open();
    await shell.openScreen("Journal & Daybook");
    await expect.poll(journal.entryCount).toBe(18);

    await journal.askToDelete(ENTRY);
    await journal.answer(true);

    await expect.poll(journal.entryCount).toBe(17);
    expect(await journal.descriptions()).not.toContain(ENTRY);

    // The entry was 44.20; the chart's grand total was 20,049.56.
    await shell.openScreen("Accounts, Ledgers & Balance");
    await expect.poll(accounts.total).toEqual({
      account: "Total",
      debit: "20,005.36",
      credit: "20,005.36",
      balance: "0.00",
    });
  });
});

const ENTRY =
  "Purchase of a holder for condominium notices, for the entrance hall";
