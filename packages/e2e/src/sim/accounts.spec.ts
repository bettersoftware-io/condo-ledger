import { expect, test } from "#/testing/test.ts";

test.describe("the chart of accounts, on the simulator", () => {
  test("opens on the first management's accounts, whose debits and credits balance", async ({
    shell,
    accounts,
  }) => {
    await shell.open();

    await expect
      .poll(shell.breadcrumb)
      .toEqual([
        "Buildings",
        "Saturno",
        "2011 (Ordinary)",
        "Accounts, Ledgers & Balance",
      ]);
    await expect.poll(accounts.total).toEqual({
      account: "Total",
      debit: "20,049.56",
      credit: "20,049.56",
      balance: "0.00",
    });
  });

  test("shows another management's own accounts when it is picked, balanced too", async ({
    shell,
    accounts,
  }) => {
    await shell.open();
    await expect.poll(accounts.total).not.toBeUndefined();

    const first = await accounts.total();

    await shell.selectManagement("2013 (Ordinary)");

    await expect.poll(shell.breadcrumb).toContain("Pozzetto");
    await expect.poll(accounts.total).not.toEqual(first);

    const other = await accounts.total();

    expect(other?.debit).toBe(other?.credit);
    expect(other?.balance).toBe("0.00");
  });
});
